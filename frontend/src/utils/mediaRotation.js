export const fitRotatedMedia = (width, height, availableWidth, availableHeight, rotation = 0, fit = 'contain') => {
  const sideways = rotation % 180 !== 0;
  const displayWidth = sideways ? height : width;
  const displayHeight = sideways ? width : height;
  const scale = (fit === 'cover' ? Math.max : Math.min)(Math.max(1, availableWidth) / displayWidth, Math.max(1, availableHeight) / displayHeight);
  return { width: width * scale, height: height * scale, displayWidth: displayWidth * scale, displayHeight: displayHeight * scale };
};
