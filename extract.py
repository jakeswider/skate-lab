import cv2
import mediapipe as mp


MAX_SECONDS = 15


def process_video(video_path):

    model_path = "pose_landmarker_heavy.task"


    BaseOptions = mp.tasks.BaseOptions
    PoseLandmarker = mp.tasks.vision.PoseLandmarker
    PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode


    options = PoseLandmarkerOptions(
        base_options=BaseOptions(
            model_asset_path=model_path
        ),
        running_mode=VisionRunningMode.VIDEO
    )


    with PoseLandmarker.create_from_options(options) as landmarker:

        cap = cv2.VideoCapture(video_path)


        fps = cap.get(
            cv2.CAP_PROP_FPS
        )

        if fps <= 0:
            fps = 30


        max_frames = int(
            fps * MAX_SECONDS
        )


        frame_time = 1000 / fps


        frames_data = []

        frame_index = 0


        start_x = None
        start_y = None


        TRAVEL_SCALE = 5.0


        while cap.isOpened():

            if frame_index >= max_frames:
                break


            ret, frame = cap.read()


            if not ret:
                break


            timestamp = int(
                frame_index * frame_time
            )


            rgb = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )


            image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb
            )


            result = landmarker.detect_for_video(
                image,
                timestamp
            )


            if (
                result.pose_world_landmarks
                and result.pose_landmarks
            ):

                world = result.pose_world_landmarks[0]
                screen = result.pose_landmarks[0]


                mid_x = (
                    screen[23].x +
                    screen[24].x
                ) / 2


                mid_y = (
                    screen[23].y +
                    screen[24].y
                ) / 2


                if start_x is None:
                    start_x = mid_x
                    start_y = mid_y


                travel_x = (
                    mid_x - start_x
                ) * TRAVEL_SCALE


                travel_y = -(
                    mid_y - start_y
                ) * TRAVEL_SCALE



                body_x = (
                    world[23].x +
                    world[24].x
                ) / 2


                body_y = (
                    world[23].y +
                    world[24].y
                ) / 2


                body_z = (
                    world[23].z +
                    world[24].z
                ) / 2



                frame_points = []


                for i, lm in enumerate(world):

                    frame_points.append({
                        "id": i,
                        "x": (
                            lm.x - body_x
                        ) + travel_x,

                        "y": -(
                            lm.y - body_y
                        ) + travel_y,

                        "z": (
                            lm.z - body_z
                        ),

                        "visibility":
                            lm.visibility
                    })


                frames_data.append(
                    frame_points
                )


            else:

                frames_data.append([])



            frame_index += 1



        cap.release()



    return {
        "frames": frames_data,
        "fps": fps
    }