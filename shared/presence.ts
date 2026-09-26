// What Discord shows about the viewer. Built by the app, sent as is by the main process.
export type Presence = {
  details: string;
  state: string;
  largeText: string;
  buttons: { label: string; url: string }[];
};
