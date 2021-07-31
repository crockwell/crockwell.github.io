// Rather than manually implementing logic about the allowed bounds on angle
// and position, we load a list of all images from a JSON data file. The set of
// scenes as well as the allowed bounds on movement will be computed from the
// contents of this file. It contains objects of the form:
// {
//   path: [string, path to image file],
//   method: [string, name of method that created the image],
//   scene: [string, name of the scene to which the image belongs],
//   angle_x: [int, horizontal angle],
//   angle_y: [int, vertical angle],
//   pos_x: [int, horizontal position],
//   pos_z: [int, depth position],
// }
const IMAGE_LIST_PATH = 'image-list-combined.json';

// This will be prepended to the image paths from the image list, in case
// images are hosted somewhere else.
const IMAGE_ROOT = './';

// Granularities specify how many images to load in demo
const granularities = ['Fast Scene Loading','Granular Scene Movement'];

// This happens first: Load the image list from the JSON file, then pass
// control to main. This is called by an event handler installed at the bottom
// of this file.
function load_image_list() {
  fetch(IMAGE_LIST_PATH)
  .then(response => response.text())
  .then(text => main(JSON.parse(text)));
}

// Main entry point: set up all objects and wire up event handlers
function main(image_list) {
  const initial_scene = '0_demo';  
  const initial_granularity = 'Fast Scene Loading';

  // Set up scene buttons
  const scene_btns = create_scene_buttons(image_list);

  // For each method, find the canvas and create a viewer
  const methods = ['input','pixelsynth', 'synsin6x', 'naive'];
  const canvases = [], viewers = [];
  for (const method of methods) {
    const canvas = document.getElementById(`${method}-canvas`);
    const viewer = new SceneViewer(canvas, image_list, method, initial_scene, initial_granularity);
    canvases.push(canvas);
    viewers.push(viewer);
  }

  // Set up reset scene button
  const reset_btn = create_reset_button();
  function reset_scene() {
    for (const viewer of viewers) {
      viewer.reset_scene();
    }
  }
  for (const [name, btn] of reset_btn) {
    btn.addEventListener('click', () => reset_scene());
  }

  // Create the event handler object
  let buttons = {
    rotate: document.getElementById('movement-btn-rotate'),
    translate: document.getElementById('movement-btn-translate'),
  }
  let handler = new EventHandler(viewers, buttons);

  // Wire up event handlers
  for (const canvas of canvases) {
    canvas.addEventListener('mousedown', handler);
    canvas.addEventListener('mousemove', handler);
    canvas.addEventListener('mouseup', handler);
    canvas.addEventListener('mouseleave', handler);
  }
  window.addEventListener('keydown', handler);
  buttons.translate.addEventListener('click', () => handler.set_move_type('translate'));
  buttons.rotate.addEventListener('click', () => handler.set_move_type('rotate'));

  // setup event handler for granularity
  const granularity_btns = create_granularity_buttons(granularities);
  function set_granularity(granularity) {
    granularity_btns.get(granularity).checked = true;
    for (const viewer of viewers) {
      viewer.set_scene(null, granularity);
    }
  }
  for (const [granularity, btn] of granularity_btns) {
    btn.addEventListener('click', () => set_granularity(granularity));
  }
  set_granularity(initial_granularity)

  // Set up handlers for the scene selection buttions. It's kind of gross to
  // inline this here -- should it go somewhere else?
  function set_scene(scene) {
    const scene_btn = scene_btns.get(scene);
    if (scene_btn === undefined) {
      throw `Invalid scene ${scene}`;
    }
    scene_btns.get(scene).checked = true;
    for (const viewer of viewers) {
      viewer.set_scene(scene);
    }
  }
  for (const [scene, btn] of scene_btns) {
    btn.addEventListener('click', () => set_scene(scene));
  }
  set_scene(initial_scene);  
}


// Helper function to add buttons to the DOM for selecting the scene.
// Returns a Map from scene name to the button DOM object.
function create_scene_buttons(image_list) {
  const scenes = find_unique_scenes(image_list);
  const scene_btn_group = document.getElementById('scene-btn-group');
  let btns_html = '';
  const scene_btn_ids = [];

  // Create an HTML string for all the buttons and add them to the DOM
  for (const scene of scenes) {
    let btn_id = `scene-btn-${scene}`;
    let btn_html = scene_btn_template(scene, btn_id);
    scene_btn_ids.push(btn_id);
    btns_html += btn_html;
  }
  scene_btn_group.innerHTML = btns_html;

  // Now look up the actual button elements we created
  const scene_btns = new Map();
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const btn_id = scene_btn_ids[i];
    const btn = document.getElementById(btn_id);
    scene_btns.set(scene, btn);
  }
  return scene_btns;
}


// Helper function to return a list of all the unique scenes in the image list
function find_unique_scenes(image_list) {
  const scenes_set = new Set();
  for (const image of image_list) {
    scenes_set.add(image.scene);
  }
  // Convert the Set to a list
  const scenes_list = [];
  for (const scene of scenes_set) {
    scenes_list.push(scene);
  }
  return scenes_list.sort();
}


// Helper function to return HTML for a scene button. This is kinda gross, but
// for just one little template I didn't want to depend on a real templating system
function scene_btn_template(scene, btn_id) {
  const input = `<input type="radio" class="btn-check" name="scene-btn-radio" id="${btn_id}">`
  const label = `<label class="btn btn-outline-primary" for="${btn_id}">${scene}</label>`
  return input + label;
}


// A data structure to store all images for a particular scene and method.
// It preloads images, then lets you look up Image objects by
// (angle_x, angle_y, position_x, position_z).
class SceneImages {

  // The provided callback is called each time an image is loaded.
  constructor(image_list, method, scene, granularity, callback) {
    // Pass through image_list and find all that match the method and scene.
    // We need to do this as a separate step so we can pass the total number
    // of images to the callback as images load; this could let us implement
    // some kind of progress bar if we wanted.
    let image_list_filtered = [];
    this.input = false
    for (const image of image_list) {
      if (method == 'input') {
        if (image.method == 'input' && image.scene === scene && image.granularity == granularity) {
        image_list_filtered.push(image)
        this.input = true
        }
      }
      else if (image.method === method && image.scene === scene && image.granularity == granularity) {
        image_list_filtered.push(image);
      }
    }

    // Now actually preload images by loading them into an internal Map
    this.img_map = new Map();
    let num_loaded = 0;
    for (var image of image_list_filtered) {
      const k = this._key(image.angle_x, image.angle_y, image.pos_x, image.pos_z);
      const img = new Image();
      this.img_map.set(k, img);

      // As each image loads we call the callback passed to the constructor.
      // This could update a progress bar if images are still loading, or
      // continue with other setup or drawing once all images are loaded.
      img.onload = function() {
        num_loaded++;
        let _status = {
          num_loaded,
          num_total: image_list_filtered.length,
        };
        callback(_status);
      };

      // We need to set up the onload handler *before* setting src; otherwise
      // if the image loads really fast the handler won't be called.
      img.src = IMAGE_ROOT + image.path;
    }
  }

  // Javascript Map objects use object identity for object keys, which makes it
  // awkward to make the Map a tuple of values. We hack it by converting a tuple
  // of values into a string, and use that as the key instead.
  _key(angle_x, angle_y, pos_x, pos_z) {
    const key_obj = [angle_x, angle_y, pos_x, pos_z];
    const key_str = JSON.stringify(key_obj);
    return key_str;
  }

  // Get an image associated with a particular position and angle. If no such
  // image exists, return undefined (which is what the underlying Map does).
  get(angle_x, angle_y, pos_x, pos_z) {
    if (this.input) {const k = this._key(0, 0, 0, 0);}
    const k = this._key(angle_x, angle_y, pos_x, pos_z);
    return this.img_map.get(k);
  }
}

// Helper function to add button to the DOM for resetting the scene.
// Returns a Map from reset name to the button DOM object.
function create_reset_button() {
  const reset_btn_group = document.getElementById('reset-btn-group');
  let btns_html = '';

  // Create an HTML string for the button and add to the DOM
  const btn_id = `reset-btn`;
  let btn_html = reset_btn_template(btn_id);
  btns_html += btn_html;

  reset_btn_group.innerHTML = btns_html;

  // Now look up the actual button elements we created
  const reset_btn = new Map();
  const btn = document.getElementById(btn_id);
  reset_btn.set('reset', btn);
  return reset_btn;
}

// Helper function to return HTML for reset button. This is kinda gross, but
// for just two* little templates I didn't want to depend on a real templating system
function reset_btn_template(btn_id) {
  const label = `<button type="button" class="btn btn-outline-primary" name="scene-btn-radio" id="${btn_id}">Reset</button>`
  return label;
}

// Helper function to add button to the DOM for changing granularity of scene
// Returns a Map from scene name to the button DOM object.
function create_granularity_buttons(granularities) {
  const granularity_btn_group = document.getElementById('granularity-btn-group');
  let btns_html = '';
  const granularity_btn_ids = [];

  // Create an HTML string for all the buttons and add them to the DOM
  for (const granularity of granularities) {
    let btn_id = `granularity-btn-${granularity}`;
    let btn_html = granularity_btn_template(granularity, btn_id);
    granularity_btn_ids.push(btn_id);
    btns_html += btn_html;
  }
  granularity_btn_group.innerHTML = btns_html;

  // Now look up the actual button elements we created
  const granularity_buttons = new Map();
  for (let i = 0; i < granularities.length; i++) {
    const granularity = granularities[i];
    const btn_id = granularity_btn_ids[i];
    const btn = document.getElementById(btn_id);
    granularity_buttons.set(granularity, btn);
  }
  return granularity_buttons;
}

// Helper function to return HTML for reset button. This is kinda gross, but
// for just two* little templates I didn't want to depend on a real templating system
function granularity_btn_template(granularity, btn_id) {
  const input = `<input type="radio" class="btn-check" name="granularity-btn-radio" id="${btn_id}">`
  const label = `<label class="btn btn-outline-primary" for="${btn_id}">${granularity}</label>`
  return input + label;
}

// A SceneViewer wraps a canvas and updates it to move or look in different
// directions. The same SceneViewer can be reused to look at results from
// different methods or scenes.
class SceneViewer {
  constructor(canvas, image_list, method, scene, granularity) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image_list = image_list;
    this.granularity = null;
    this.scene = null;
    this.set_method_and_scene(method, scene, granularity);
  }

  set_method_and_scene(method, scene = null, granularity = null) {
    this.method = method;
    if (scene != null) {this.scene = scene;}
    if (granularity != null) {this.granularity = granularity;}
    this.angle_x = 0;
    this.angle_y = 0;
    this.pos_x = 0;
    this.pos_z = 0;
    this.loaded = false;

    // Inside the callback "this" won't be set, so stash a reference.
    const _this = this;

    // This callback will be called as each image loads.
    function callback(_status) {
      const loaded = _status.num_loaded;
      const total = _status.num_total;
      const ctx = _this.ctx;
      const width = _this.canvas.width, height = _this.canvas.height;

      // If images are not loaded, write a status message to the canvas.
      if (loaded < total) {
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        let msg = `Loaded ${loaded} / ${total}`;
        ctx.textAlignt = 'center';
        ctx.font = '16px Arial';
        ctx.fillText(msg, width / 2, height / 2);
        ctx.restore();
        return;
      }
      // Once all images are loaded we can draw the initial image.
      _this.loaded = true;
      _this.draw();
    }
    this.scene_images = new SceneImages(this.image_list, method, this.scene, this.granularity, callback);
  }

  set_scene(scene = null, granularity = null) {
    this.set_method_and_scene(this.method, scene, granularity);
  }

  // Use the current state of the SceneViewer to fetch an Image from the
  // underlying SceneImages collection.
  _get_img() {
    const ax = this.angle_x, ay = this.angle_y;
    const px = this.pos_x, pz = this.pos_z;
    return this.scene_images.get(ax, ay, px, pz);
  }

  // Draw the image to the canvas
  draw() {
    if (!this.loaded) return;
    const img = this._get_img();
    if (img === undefined) return;
    this.ctx.drawImage(img, 0, 0);
  }

  // Reset to move 0 and rotate 0
  reset_scene() {
    this.set_method_and_scene(this.method, this.scene, this.granularity);
  }


  // Helper to move an arbitrary amount in any direciton.
  // If the move would go outside the available images, then nothing happens.
  move(prop, delta) {
    if (!this.loaded) return;
    const old_val = this[prop];
    this[prop] += delta;
    if (this._get_img() === undefined) {
      this[prop] = old_val;
      return;
    }
    this.draw();
  }

  // Change the angle
  angle_left() { this.move('angle_x', -1); }
  angle_right() { this.move('angle_x', 1); }
  angle_up() { this.move('angle_y', 1); }
  angle_down() { this.move('angle_y', -1); }

  // Change the position
  pos_left() { this.move('pos_x', -1); }
  pos_right() { this.move('pos_x', 1); }
  pos_forward() { this.move('pos_z', 1); }
  pos_backward() { this.move('pos_z', -1); }

}


// Handles all events, and updates the UI as needed. This class handles updates
// to the translate and rotate buttons, but the scene selection buttons are
// dealt with by an inline event handler function in main. Gross.
class EventHandler {
  constructor(viewers, buttons) {
    this.viewers = viewers;

    this.handlers = {
      'mousedown': this.mousedown_handler,
      'mouseup': this.mouseup_handler,
      'mouseleave': this.mouseup_handler,
      'mousemove': this.mousemove_handler,
      'keydown': this.keydown_handler,
    };

    this.mouse_down = false;

    this.translate_btn = buttons.translate;
    this.rotate_btn = buttons.rotate;

    this.set_move_type('rotate');
  }

  set_move_type(move_type) {
    if (move_type !== 'translate' && move_type !== 'rotate') {
      throw `Invalid move type: ${move_type}`;
    }
    this.move_type = move_type;
    this.update_move_type_buttons();
  }

  toggle_move_type() {
    if (this.move_type === 'translate') {
      this.move_type = 'rotate';
    } else if (this.move_type === 'rotate') {
      this.move_type = 'translate';
    }
    this.update_move_type_buttons();
  }

  update_move_type_buttons() {
    if (this.move_type === 'translate') {
      this.translate_btn.checked = true;
    } else if (this.move_type === 'rotate') {
      this.rotate_btn.checked = true;
    }
  }

  move_viewers(direction) {
    if (direction === null || direction === undefined) return;
    for (const viewer of this.viewers) {
      viewer[direction]();
    }
  }

  // This is called whenever an event happens. We dispatch to different instance
  // methods depending on the type of the event.
  handleEvent(e) {
    let fn = this.handlers[e.type];
    if (fn !== undefined) {
      // If we call the function like "fn()" then "this" won't be set inside the
      // function call, so we need to call it like this instead.
      fn.call(this, e);
    }
  }

  mousedown_handler(e) {
    this.mouse_down = true;
    this.click_start_x = e.clientX;
    this.click_start_y = e.clientY;
  }

  // Maps a mouse move direction to a scene movement. Some are flipped;
  // e.g. when the mouse moves to the right, the scene should rotate to the left
  static movements = {
    rotate: {
      left: 'angle_right',
      right: 'angle_left',
      up: 'angle_up',
      down: 'angle_down',
    },
    translate: {
      left: 'pos_left',
      right: 'pos_right',
      up: 'pos_backward',
      down: 'pos_forward',
    }
  }

  mousemove_handler(e) {
    if (!this.mouse_down) return;

    // How many pixels the mouse needs to move before we move the scene
    const thresh = 10;

    // First figure out horizontal mouse movement
    let dx = e.clientX - this.click_start_x;
    let x_movement = null;
    if (dx > thresh) {
      this.click_start_x = e.clientX;
      x_movement = EventHandler.movements[this.move_type].right;
    } else if (dx < -thresh) {
      this.click_start_x = e.clientX;
      x_movement = EventHandler.movements[this.move_type].left;
    }
    this.move_viewers(x_movement);

    // Now figure out vertical mouse movement
    let dy = e.clientY - this.click_start_y;
    let y_movement = null;
    if (dy < -thresh) {
      this.click_start_y = e.clientY;
      y_movement = EventHandler.movements[this.move_type].up;
    } else if (dy > thresh) {
      this.click_start_y = e.clientY;
      y_movement = EventHandler.movements[this.move_type].down;
    }
    this.move_viewers(y_movement);
  }

  mouseup_handler(e) {
    this.mouse_down = false;
    this.click_start_x = undefined;
    this.click_start_y = undefined;
  }

  keydown_handler(e) {
    if (e.key === 'Shift') {
      this.toggle_move_type();
    }
    else if (e.key === 'w') {
      this.move_viewers(EventHandler.movements[this.move_type].down);
    }
    else if (e.key === 'a') {
      this.move_viewers(EventHandler.movements[this.move_type].right);
    }
    else if (e.key === 's') {
      this.move_viewers(EventHandler.movements[this.move_type].up);
    }
    else if (e.key === 'd') {
      this.move_viewers(EventHandler.movements[this.move_type].left);
    }
  }
}

// Finanally, kick everything off by loading the image list once the page loads
window.addEventListener('load', load_image_list());  