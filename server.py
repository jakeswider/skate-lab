from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os
import cv2
import uuid
import logging
from threading import Lock

from extract import process_video


app = Flask(__name__, static_folder="frontend")


# -------------------------
# Protection
# -------------------------

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[]
)

processing_lock = Lock()


@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com "
        "'sha256-FreBnA+Jtlu/i9olsxx9J6Tw6s/pT/DuX2c36oE/pd4='; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: blob:; "
        "media-src 'self' blob:; "
        "connect-src 'self' https://unpkg.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "object-src 'none'; "
        "base-uri 'self'"
    )
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    return response


# -------------------------
# Config
# -------------------------

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

MAX_VIDEO_SECONDS = 15

UPLOAD_FOLDER = "data/uploads"
DEMO_FOLDER = "data/demo"

ALLOWED_EXTENSIONS = {
    "mp4",
    "mov",
    "avi",
    "webm"
}


os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# -------------------------
# Helpers
# -------------------------

def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


# -------------------------
# Errors
# -------------------------

@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "File too large. Maximum size is 50MB."
    }), 413


@app.errorhandler(429)
def rate_limit_handler(error):
    return jsonify({
        "error": "Too many requests. Try again later."
    }), 429


# -------------------------
# Routes
# -------------------------

@app.route("/health")
def health():
    return jsonify({
        "status": "ok"
    })


@app.route("/")
def index():
    return send_from_directory(
        "frontend",
        "app.html"
    )


@app.route("/js/<path:path>")
def serve_js(path):
    return send_from_directory(
        "frontend/js",
        path
    )


@app.route("/upload", methods=["POST"])
@limiter.limit("5 per minute")
def upload_file():

    # Only allow one MediaPipe job at a time
    if not processing_lock.acquire(blocking=False):
        return jsonify({
            "error": "Server busy. Try again."
        }), 429


    filepath = None


    try:

        if "video" not in request.files:
            return jsonify({
                "error": "No video provided"
            }), 400


        file = request.files["video"]


        if not file.filename:
            return jsonify({
                "error": "No filename"
            }), 400


        if not allowed_file(file.filename):
            return jsonify({
                "error": "Unsupported format"
            }), 400


        # unique filename
        ext = file.filename.rsplit(".", 1)[1].lower()

        filename = (
            secure_filename(
                uuid.uuid4().hex
            )
            + "."
            + ext
        )


        filepath = os.path.join(
            UPLOAD_FOLDER,
            filename
        )


        file.save(filepath)


        # validate video
        cap = cv2.VideoCapture(filepath)

        fps = cap.get(cv2.CAP_PROP_FPS)
        frames = cap.get(
            cv2.CAP_PROP_FRAME_COUNT
        )

        cap.release()


        if fps <= 0 or frames <= 0:
            return jsonify({
                "error": "Invalid video"
            }), 400


        duration = frames / fps


        if duration > MAX_VIDEO_SECONDS:
            return jsonify({
                "error":
                    f"Video exceeds {MAX_VIDEO_SECONDS}s limit"
            }), 400



        result = process_video(filepath)


        return jsonify({
            "frames": result["frames"],
            "fps": result["fps"]
        })


    except Exception:
        logging.exception(
            "Video processing failed"
        )

        return jsonify({
            "error": "Video processing failed"
        }), 500


    finally:

        if filepath and os.path.exists(filepath):
            os.remove(filepath)

        processing_lock.release()



@app.route("/demo_video")
def demo_video():

    return send_from_directory(
        DEMO_FOLDER,
        "skate-lab-demo.mov"
    )


if __name__ == "__main__":
    app.run(debug=False)