const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfprobePath(ffprobeStatic.path);

ffmpeg.setFfmpegPath(ffmpegStatic || "../tmp");

const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration ?? 0);
      }
    });
  });
};

module.exports = {
  getVideoDuration,
};
