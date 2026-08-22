# Skate Lab

Turns skate videos into 3D skeleton data so you can study tricks frame by frame.

**Author:** Jacob Swider

## How it works

Two parts:

- **Backend (Python, OpenCV, MediaPipe):** Runs MediaPipe's Heavy Pose Landmarker on uploaded video to pull out (x, y, z) joint coordinates per frame. Video is processed in memory and deleted right after, never saved to disk.
- **Frontend (Three.js):** Takes the coordinate data and renders it as a 3D figure in the browser. Smooths jitter between frames, hides limbs when tracking confidence is low, and lets you move a camera around the scene.

## Features

- **No video storage:** files are deleted immediately after processing.
- **Ghost mode:** upload a second clip and line it up next to the first in 3D (manual X/Y/Z offsets) to compare things like foot placement between a landed trick and a bail.
- **Adjustable ledge:** rough in a 3D obstacle to check contact points against.

## Running it locally

1. Clone the repo
2. Set up a virtual environment (`venv`, `uv`, whatever)
3. `pip install flask opencv-python mediapipe`
4. `python server.py`

## Model file

Needs `pose_landmarker_heavy.task` in the root directory to run.
