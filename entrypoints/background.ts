export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('Startup tab is ready.', { id: browser.runtime.id });
  });
});
