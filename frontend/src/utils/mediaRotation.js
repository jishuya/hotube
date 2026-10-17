export const fitRotatedMedia = (width, height, availableWidth, availableHeight, rotation = 0) => {
  const sideways = rotation % 180 !== 0;
  const displayWidth = sideways ? height : width;
  const displayHeight = sideways ? width : height;
  const scale = Math.min(Math.max(1, availableWidth) / displayWidth, Math.max(1, availableHeight) / displayHeight);
  return { width: width * scale, height: height * scale, displayWidth: displayWidth * scale, displayHeight: displayHeight * scale };
};
