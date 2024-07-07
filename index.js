const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { join } = require("path");
const { getVideoDuration } = require("./utils");
const {
  VIDEO_DURATION,
  TIME_START,
  PRODUCT,
  VIDEO_INPUT,
  VIDEO_BACKUP,
  RAW_OUTPUT_PATH,
  OUTPUT_PATH,
  AUDIO,
  TEXT,
} = require("./config");

ffmpeg.setFfmpegPath(ffmpegStatic);

const splitVideo = (inputFile, outputPattern, startTime, segmentDuration) => {
  return new Promise((resolve, reject) => {
    console.log("Splitting video...", outputPattern);
    ffmpeg(inputFile)
      .setStartTime(startTime)
      .setDuration(segmentDuration)
      .videoFilters({
        filter: "crop",
        options: {
          w: "ih*9/16",
          h: "ih",
          x: "(iw-ow)/2",
          y: "0",
        },
      })
      .output(outputPattern)
      .on("error", function (err) {
        console.log("An error occurred: " + err.message);
        reject(err);
      })
      .on("end", function () {
        resolve();
      })
      .run();
  });
};

const addWatermarkProduction = (inputFile, outputFile, watermarkFile) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .input(watermarkFile)
      .complexFilter([
        "[1:v]scale=500:500[watermark]",
        "[0:v][watermark]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2:enable='between(t,8,1000000000)'",
      ])
      .on("error", function (err) {
        console.log("An error occurred: " + err.message);
        reject(err);
      })
      .on("end", function () {
        resolve();
      })
      .save(outputFile);
  });
};

const addWatermarkText = (inputFile, outputFile, watermarkFile) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .input(watermarkFile)
      .input(AUDIO)
      .duration(10)
      .complexFilter([
        "[1:v]scale=500:500[watermark]",
        "[0:v][watermark]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2:enable='between(t,0,8)'", // Apply the overlay filter from the 8th second onwards and position it in the center
      ])
      .audioCodec("copy")
      .on("error", function (err) {
        console.log("An error occurred: " + err.message);
        reject(err);
      })
      .on("end", function () {
        resolve();
      })
      .save(outputFile);
  });
};

const incrementInSeconds = (time, incrementInSeconds) => {
  // Convert the time string to a Date object
  const parts = time.split(":");
  const date = new Date();
  date.setHours(+parts[0]);
  date.setMinutes(+parts[1]);
  date.setSeconds(+parts[2]);

  // Increment the time
  date.setSeconds(date.getSeconds() + incrementInSeconds);

  // Format the new time as a string
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

const initGenerateVideo = async () => {
  const videoExist = fs.existsSync(VIDEO_INPUT);

  let videoPath = VIDEO_INPUT;
  if (!videoExist) {
    videoPath = VIDEO_BACKUP;
  }

  const duration = await getVideoDuration(videoPath);

  const numberVideos = Math.ceil(duration / parseInt(VIDEO_DURATION)) - 3;

  let time = TIME_START;

  const chunks = Array.from({ length: numberVideos }, (_, i) => i);

  for (const i of chunks) {
    const outputPattern = join(RAW_OUTPUT_PATH, `${i + 1}.mp4`);

    try {
      //#region split video
      await splitVideo(
        videoPath,
        outputPattern,
        time,
        parseInt(VIDEO_DURATION)
      );
      time = incrementInSeconds(time, parseInt(VIDEO_DURATION));
      console.log("Split video: ", time);

      //#region add watermark product
      const outputPatternWatermark = join(RAW_OUTPUT_PATH, `tmp-${i + 1}.mp4`);
      await addWatermarkProduction(
        outputPattern,
        outputPatternWatermark,
        PRODUCT
      );
      console.log("Add watermark: ", RAW_OUTPUT_PATH);

      const outputPatternText = join(OUTPUT_PATH, `${i + 1}.mp4`);
      await addWatermarkText(outputPatternWatermark, outputPatternText, TEXT);

      //clear tmp file
      fs.unlinkSync(outputPatternWatermark);
    } catch (error) {
      console.log("Error: ", error);

      return;
    }
  }

  return;
};

initGenerateVideo();
