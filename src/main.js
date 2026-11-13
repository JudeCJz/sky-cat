// Sky Cat entry: start the requested scene (default boot), then run the loop.
(function () {
  'use strict';
  const SC = window.SC;
  let scene = SC.flags.scene || 'boot';
  if (!SC.hasScene(scene)) scene = 'boot';
  SC.go(scene, scene === 'play' ? { mode: 'endless' } : {});
  SC.run();
})();
