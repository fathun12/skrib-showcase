// iPhone start-up images (the screen that shows while the installed app
// opens). iOS picks an image only when the media query matches the exact
// screen, so there is one row per iPhone screen size (portrait, in CSS
// points). A phone that is not in the list shows a plain screen instead.
// The files are made for light and dark (the phone's own setting) and live
// in public/splash/<width>x<height>[-dark].png (in real pixels).
const DEVICES = [
  { width: 440, height: 956, ratio: 3 },
  { width: 420, height: 912, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 414, height: 896, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 736, ratio: 3 },
  { width: 375, height: 667, ratio: 2 },
];

export const SPLASH_IMAGES = DEVICES.flatMap(({ width, height, ratio }) => {
  const screen =
    `(device-width: ${width}px) and (device-height: ${height}px)` +
    ` and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
  const file = `/splash/${width * ratio}x${height * ratio}`;
  return [
    {
      url: `${file}.png`,
      media: `${screen} and (prefers-color-scheme: light)`,
    },
    {
      url: `${file}-dark.png`,
      media: `${screen} and (prefers-color-scheme: dark)`,
    },
  ];
});