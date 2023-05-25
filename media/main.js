const vscode = acquireVsCodeApi();
const CUSTOMCOLOR = {
  RED: '#ad2323',
  GREEN: '#1d6914',
  BLUE: '#2a4bd7',
  CYAN: '#29d0d0',
  MAGENTA: '#8126c0',
  YELLOW: '#ffee33',
  WHITE: '#ffffff',
  GRAY1: '#1c1c1c',
  GRAY2: '#383838',
  GRAY3: '#555555',
  GRAY4: '#717171',
  GRAY5: '#8d8d8d',
  GRAY6: '#aaaaaa',
  GRAY7: '#c6c6c6',
  GRAY8: '#e2e2e2',
};
let liveUpdate = true;
window.addEventListener('message', async (event) => {
  let uiData = event.data; // The JSON data our extension sent
  liveUpdate = false;
  // console.log(uiData);
  if (await isFontReady()) {
    uiData.forEach((ui) => {
      const id = new Date().valueOf();
      switch (ui.name) {
        case 'rect':
          createRectangle(id, ui);
          break;
        case 'line':
          createStraightLine(id, ui);
          break;
        case 'polygone':
          createStraightLine(id, ui);
          break;
        case 'polyline':
          createStraightLine(id, ui);
          break;
        case 'text':
          createText(id, ui);
          break;
        default:
          break;
      }
    });
    layer.draw();
  }

  liveUpdate = true;
});
let debounceTimer;

const debounce = (func, wait) => {
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), wait);
  };
};
var width = 640;
var height = 400;
const ANCHORS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'top-center',
  'bottom-center',
  'middle-right',
  'middle-left',
];
const shapeBtns = document.querySelectorAll('.shape-btn'); // add a variable for staraight  line
const alignBtns = document.querySelectorAll('.alignBtn'); // add a variable for staraight  line
const colorInput = document.getElementById('colorselection');
const thicknessBtn = document.getElementById('thicknessBtn');
const deleteButton = document.getElementById('delete');

document
  .getElementById('selected_color')
  .addEventListener('click', function () {
    document.getElementById('pigment_pick').classList.add('pickbox_show');
  });
document
  .querySelectorAll('#pigment_pick .item .pigment_box')
  .forEach(function (el) {
    el.addEventListener('click', function () {
      let color = el.getAttribute('style');
      // console.log(color);
      document.getElementById('selected_color').setAttribute('style', color);
      document.getElementById('pigment_pick').classList.remove('pickbox_show');
      updateColor(
        CUSTOMCOLOR[el.getAttribute('data-color')],
        el.getAttribute('data-color')
      );
    });
  });

const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
var currentSelection = null;
const DELTA = 4;
var intention = 'click';
var detectIntention = null;
const dropDown = { value: 1 };
window.addEventListener('keydown', function (event) {
  document.getElementById('myDropdown').style.display = 'none';
  const key = event.key; // const {key} = event; ES6+
  if (event.ctrlKey && (key === 'a' || key === 'A')) {
    let shapes = stage.find('.rect,.line,.text,.polyline,.polygone');
    if (
      shapes.length === 1 &&
      ['line', 'polyline', 'polygone'].includes(shapes[0].name())
    ) {
      shapes[0]
        .getParent()
        .find('.line-anchor')
        .forEach((la) => {
          la.visible(true);
        });
    } else {
      tr.nodes(shapes);
    }
    event.preventDefault();
    return;
  }
  if (event.ctrlKey && (key === 'd' || key === 'D') && tr.nodes().length > 0) {
    let shapes = tr.nodes();

    let newshapes = [];
    shapes.forEach((sh) => {
      const id = new Date().valueOf();

      let newshape = sh.clone({ x: sh.x() + 10, y: sh.y() + 10, id });
      layer.add(newshape);
      newshapes.push(newshape);
    });
    tr.nodes(newshapes);
    event.preventDefault();
    return;
  }
  let offset = DELTA;
  if (event.ctrlKey && arrowKeys.includes(key)) {
    offset = 1;
  }
  if (key === 'ArrowLeft') {
    tr.nodes().forEach((node) => {
      node.x(node.x() - offset);
    });
    stage.find('.line,.polyline,.polygone').forEach((l) => {
      let anchors = l.getParent().find('.line-anchor');
      if (anchors[0].visible()) {
        let points = l.points().slice();
        let newPoints = points.map((p, ind) =>
          ind % 2 === 0 ? p - offset : p
        );
        l.points(newPoints);
        for (let i = 0; i < newPoints.length; i += 2) {
          anchors[i / 2].setAttrs({ x: newPoints[i], y: newPoints[i + 1] });
        }
      }
    });
  }
  if (key === 'ArrowRight') {
    tr.nodes().forEach((node) => {
      node.x(node.x() + offset);
    });
    stage.find('.line,.polyline,.polygone').forEach((l) => {
      let anchors = l.getParent().find('.line-anchor');
      if (anchors[0].visible()) {
        let points = l.points().slice();
        let newPoints = points.map((p, ind) =>
          ind % 2 === 0 ? p + offset : p
        );
        l.points(newPoints);
        for (let i = 0; i < newPoints.length; i += 2) {
          anchors[i / 2].setAttrs({ x: newPoints[i], y: newPoints[i + 1] });
        }
      }
    });
  }
  if (key === 'ArrowUp') {
    tr.nodes().forEach((node) => {
      node.y(node.y() - offset);
    });
    stage.find('.line,.polyline,.polygone').forEach((l) => {
      let anchors = l.getParent().find('.line-anchor');
      if (anchors[0].visible()) {
        let points = l.points().slice();
        let newPoints = points.map((p, ind) =>
          ind % 2 !== 0 ? p - offset : p
        );
        l.points(newPoints);
        for (let i = 0; i < newPoints.length; i += 2) {
          anchors[i / 2].setAttrs({ x: newPoints[i], y: newPoints[i + 1] });
        }
      }
    });
  }
  if (key === 'ArrowDown') {
    tr.nodes().forEach((node) => {
      node.y(node.y() + offset);
    });
    stage.find('.line,.polyline,.polygone').forEach((l) => {
      let anchors = l.getParent().find('.line-anchor');
      if (anchors[0].visible()) {
        let points = l.points().slice();
        let newPoints = points.map((p, ind) =>
          ind % 2 !== 0 ? p + offset : p
        );
        l.points(newPoints);
        for (let i = 0; i < newPoints.length; i += 2) {
          anchors[i / 2].setAttrs({ x: newPoints[i], y: newPoints[i + 1] });
        }
      }
    });
  }
  if (key === 'Delete') {
    // if(tr.nodes().length>0){

    deleteSelected();
    // }
  }
  if (key === 'Escape') {
    // if(tr.nodes().length>0){
    if (movingId && ['POLYLINE', 'POLYGONE'].includes(currentSelection)) {
      let objj = stage.findOne('#m' + movingId);
      objj.destroy();
      movingId = null;
      currentSelection = null;
      sendUIData();
      stage.container().style.cursor = 'default';
    }

    // }
  }
});
thicknessBtn.addEventListener('click', function () {
  document.getElementById('myDropdown').style.display = 'inline-block';
});
const allThicknessOptions = document.querySelectorAll('.t-op');
allThicknessOptions.forEach((tb) => {
  tb.addEventListener('click', function () {
    dropDown.value = parseInt(tb.getAttribute('data-thick'));
    const selectedValue = dropDown.value;
    stage.find('.line,.polyline').forEach((l) => {
      if (l.getParent().find('.line-anchor')[0].visible()) {
        l.strokeWidth(selectedValue);
      }
    });
    thicknessBtn.querySelector('span').innerHTML = dropDown.value;
    document.getElementById('myDropdown').style.display = 'none';
  });
});
shapeBtns.forEach((btn) => {
  btn.addEventListener('click', function () {
    currentSelection = btn.value;
    btn.classList.add('active');
    stage.container().style.cursor = 'crosshair';
  });
});

colorInput.addEventListener('change', function () {
  let color = this.value;
  document
    .getElementById('selected_color_custom')
    .setAttribute('style', 'background-color:' + color + ';');
  updateColor(color);
});

alignBtns.forEach((btn) => {
  btn.addEventListener('click', function () {
    let isHz = btn.classList.contains('hz');
    document
      .querySelectorAll('.alignBtn.active' + (isHz ? '.hz' : '.vt'))
      .forEach((el) => {
        el?.classList.remove('active');
      });
    btn.classList.add('active');
    tr.nodes().forEach((shp) => {
      if (shp.name() === 'text') {
        shp.setAttrs({ alignment: getCurrentAlignment() });
        shp.setAttrs(calculateOffset(shp));
      }
    });
  });
});
function getCurrentAlignment() {
  let horz = document.querySelector('.alignBtn.hz.active').value;
  let vert = document.querySelector('.alignBtn.vt.active').value;
  return vert + '_' + horz;
  //  return "TOP_LEFT";
}
function deleteSelected() {
  tr.nodes().forEach((node) => {
    node.destroy();
  });
  tr.nodes([]);
  stage.find('.line,.polyline,.polygone').forEach((l) => {
    if (l.getParent().find('.line-anchor')[0].visible()) {
      l.getParent().destroy();
    }
  });
  sendUIData();
  stage.container().style.cursor = 'default';
  layer.draw();
}
deleteButton.addEventListener('click', deleteSelected);

var stage = new Konva.Stage({
  container: 'container',
  width: width,
  height: height,
});

var layer = new Konva.Layer();
stage.add(layer);

const tr = new Konva.Transformer({
  anchorFill: '#526D82',
  anchorSize: 10,
  borderDash: [3, 3],
  anchorStrokeWidth: 0,
  enabledAnchors: ANCHORS.splice(0, 4),
  keepRatio: false,
  rotateAnchorOffset: 30,
  rotateEnabled: false,
  flipEnabled: true,
  borderStroke: '#526D82',
});
tr.anchorCornerRadius(5);
layer.add(tr);
stage.getContainer().style.backgroundColor = 'rgb(0, 0, 0)';
// add a new feature, lets add ability to draw selection rectangle
var selectionRectangle = new Konva.Rect({
  // fill: 'rgba(255,255,255,0.5)',
  stroke: '#526D82',
  strokeWidth: 1,
  dash: [3, 3],
  visible: false,
});
layer.add(selectionRectangle);

var x1, y1, x2, y2;
let line_anchors = {};
let movingId = null;

stage.on('mousedown touchstart', (e) => {
  // do nothing if we mousedown on any shape
  if (currentSelection === null && e.target !== stage) {
    return;
  }
  intention = 'click';
  detectIntention = setTimeout(function () {
    intention = 'mouseup';
    stage.container().style.cursor = 'crosshair';
  }, 500);
  x1 = stage.getPointerPosition().x;
  y1 = stage.getPointerPosition().y;
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;

  selectionRectangle.width(0);
  selectionRectangle.height(0);
  const id = new Date().valueOf();
  document
    .querySelector('.shape-btn[value="' + currentSelection + '"')
    ?.classList.remove('active');
  if (currentSelection === 'RECT') {
    createRectangle(id);

    currentSelection = null;
    // selectionRectangle.visible(true);
  }

  // if(currentSelection==="STRAIGHTLINE"){
  //   createStraightLine(id)
  //   // currentSelection =null;
  //   // selectionRectangle.visible(true);

  // }
  if (['POLYLINE', 'STRAIGHTLINE', 'POLYGONE'].includes(currentSelection)) {
    let selectorr = 'line';
    if (currentSelection === 'POLYLINE') {
      selectorr = 'polyline';
    }
    if (currentSelection === 'POLYGONE') {
      selectorr = 'polygone';
    }
    if (movingId) {
      const shp = stage.findOne('#m' + movingId);
      let line = shp.findOne('.' + selectorr);
      // let anchors  = shp.find('.line-anchor');
      // anchors[anchors.length-1].setAttrs({
      //   x:x2,
      //   y:y2
      // });
      if (currentSelection === 'STRAIGHTLINE') {
        currentSelection = null;
        movingId = null;
      } else {
        let points = line.points().slice();
        points.push(stage.getPointerPosition().x);
        points.push(stage.getPointerPosition().y);
        line.points(points);
        const anchor = new Konva.Circle({
          x: stage.getPointerPosition().x,
          y: stage.getPointerPosition().y,
          radius: 5,
          fill: '#526D82',
          draggable: true,
          name: 'line-anchor',
          visible: false,
        });
        shp.add(anchor);
        function updateLine() {
          let anchors = shp.find('.line-anchor');
          let newpoints = anchors.map((anch) => [anch.x(), anch.y()]);
          line.points(newpoints.flat());
        }

        anchor.on('dragmove', updateLine);
        anchor.on('dragmove', updateLine);
      }
    } else {
      movingId = id;
      let attrs = {
        points: [
          stage.getPointerPosition().x,
          stage.getPointerPosition().y,
          stage.getPointerPosition().x,
          stage.getPointerPosition().y,
        ],
        name: selectorr,
        closed: currentSelection === 'POLYGONE',

        //   draggable: true,
      };
      if (currentSelection === 'POLYGONE') {
        attrs = {
          ...attrs,
          fill: colorInput.value,
          stroke: colorInput.value,
          strokeWidth: 1,
        };
      } else {
        attrs = {
          ...attrs,
          stroke: colorInput.value,
          strokeWidth: dropDown.value,
        };
      }
      createStraightLine(id, attrs);
    }

    // currentSelection =null;
    // selectionRectangle.visible(true);
  }

  if (currentSelection === 'ADDTEXT') {
    createText(id);
    currentSelection = null;
  }
  tr.moveToTop();
  selectionRectangle.visible(true);
});

stage.on('mousemove touchmove', (e) => {
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;
  const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;

  // console.log(e.evt.shiftKey)
  // if line in progress
  if (
    movingId &&
    ['POLYLINE', 'STRAIGHTLINE', 'POLYGONE'].includes(currentSelection)
  ) {
    const shp = stage.findOne('#m' + movingId);
    let selectorr = '.line';
    if (currentSelection === 'POLYLINE') {
      selectorr = '.polyline';
    }
    if (currentSelection === 'POLYGONE') {
      selectorr = '.polygone';
    }
    const line = shp.findOne(selectorr);
    const points = line.points().slice();
    const pl = points.length;
    if (metaPressed) {
      let px1 = points[pl - 4];
      let py1 = points[pl - 3];
      let px2 = x2;
      let py2 = y2;
      let dx = px2 - px1;
      let dy = py2 - py1;
      let ang = Math.round(Math.atan2(dy, dx) * (4 / Math.PI)) * 45;
      if (Math.abs(ang) === 0 || Math.abs(ang) === 180) {
        points[pl - 2] = x2;
        points[pl - 1] = py1;
      } else if (Math.abs(ang) === 90) {
        points[pl - 2] = px1;
        points[pl - 1] = y2;
      } else {
        let r = Math.abs(Math.sqrt(dx * dx + dy * dy));
        let cosx = r * Math.cos((ang * Math.PI) / 180);
        let sinx = r * Math.sin((ang * Math.PI) / 180);
        points[pl - 2] = px1 + cosx;
        points[pl - 1] = py1 + sinx;
      }
    } else {
      points[pl - 2] = x2;
      points[pl - 1] = y2;
    }
    // points[pl-2] = x2;
    // points[pl-1] = y2;
    line.points(points);
    let anchors = shp.find('.line-anchor');
    anchors[anchors.length - 1].setAttrs({
      x: points[pl - 2],
      y: points[pl - 1],
    });
    e.evt.preventDefault();

    return;
  }
  // do nothing if we didn't start selection
  if (!selectionRectangle.visible()) {
    return;
  }

  if (movingId) {
    const shp = stage.findOne('#m' + movingId);
    if (shp.name() === 'rect') {
      shp.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    } else if (shp.name() === 'text') {
      // shp.setAttrs({
      //   x: Math.min(x1, x2),
      //   y: Math.min(y1, y2),
      //   width: Math.abs(x2 - x1),
      // });
    } else if (shp.name() === 'line-group') {
      // let selectorr='.line';
      // if(currentSelection==='POLYLINE'){
      //   selectorr = '.polyline';
      // }
      // const line = shp.findOne(selectorr)
      // const points = line.points().slice();
      // points[points.length-2] = x2;
      // points[points.length-1] = y2;
      // line.points(points);
      // let anchors  = shp.find('.line-anchor');
      // anchors[anchors.length-1].setAttrs({
      //   x:x2,
      //   y:y2
      // });
    }
  }

  selectionRectangle.setAttrs({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  });
});
stage.on('dblclick', function () {
  if (movingId && ['POLYLINE', 'POLYGONE'].includes(currentSelection)) {
    let selectorr = '.polygone';
    if (currentSelection === 'POLYLINE') {
      selectorr = '.polyline';
    }
    let shp = stage.findOne('#m' + movingId);
    let line = shp.findOne(selectorr);
    let points = line.points().slice();
    let anchors = shp.find('.line-anchor');
    anchors[anchors.length - 1].destroy();
    anchors[anchors.length - 2].destroy();
    line.points(points.slice(0, points.length - 4));
    movingId = null;
    currentSelection = null;
  }
  sendUIData();
  stage.container().style.cursor = 'default';
  // sendUIData();
});
stage.on('mouseup touchend', (e) => {
  // do nothing if we didn't start selection
  if (!selectionRectangle.visible()) {
    return;
  }
  if (movingId) {
    if (['POLYLINE', 'POLYGONE', 'STRAIGHTLINE'].includes(currentSelection)) {
      return;
    }
  }
  e.evt.preventDefault();
  // update visibility in timeout, so we can check it in click event
  setTimeout(() => {
    selectionRectangle.visible(false);
  });
  clearInterval(detectIntention);
  if (intention === 'click') {
    onClickEvent(e);
    stage.container().style.cursor = 'default';

    sendUIData();
    return;
  }

  if (movingId) {
    if (['POLYLINE', 'POLYGONE', 'STRAIGHTLINE'].includes(currentSelection)) {
      return;
    }
    const shp = stage.findOne('#m' + movingId);
    if (shp.name() !== 'line-group') {
      tr.nodes([shp]);
    }
    // vscode.postMessage(ALL_OBJECTS[movingId].getAttrs());
    movingId = null;
    // selectionRectangle.visible(false);
    sendUIData();
    stage.container().style.cursor = 'default';
    currentSelection = null;
    return;
  }
  let shapes = stage.find('.rect,.line,.text,.polyline,.polygone');
  let box = selectionRectangle.getClientRect();
  let selected = shapes.filter((shape) =>
    Konva.Util.haveIntersection(box, shape.getClientRect())
  );
  if (
    selected.length === 1 &&
    ['line', 'polyline', 'polygone'].includes(selected[0].name())
  ) {
    selected[0]
      .getParent()
      .find('.line-anchor')
      .forEach((la) => {
        la.visible(true);
      });
  } else {
    tr.nodes(selected);
  }
  if (selected.length > 1) {
    tr.shouldOverdrawWholeArea(true);
  }
  stage.container().style.cursor = 'default';

  sendUIData();
});

// clicks should select/deselect shapes
stage.on('click tap', function (e) {
  document.getElementById('myDropdown').style.display = 'none';
  // if we are selecting with rect, do nothing
  if (selectionRectangle.visible()) {
    return;
  }
  onClickEvent(e);
});
function onClickEvent(e) {
  // if click on empty area - remove all selections
  if (e.target === stage) {
    tr.nodes([]);
    stage.find('.line-anchor').forEach((la) => {
      la.visible(false);
    });
    tr.shouldOverdrawWholeArea(false);
    return;
  }
  // console.log(e);
  // do nothing if clicked NOT on our rectangles
  if (
    ['line', 'line-group', 'line-anchor', 'polyline', 'polygone'].includes(
      e.target.name()
    )
  ) {
    // console.log(e)
    if (e.target.name() === 'line-group') {
      e.target.find('.line-anchor').forEach((la) => {
        la.visible(true);
      });
    } else {
      e.target
        .getParent()
        .find('.line-anchor')
        .forEach((la) => {
          la.visible(true);
        });
    }
    return;
  }

  // do we pressed shift or ctrl?
  const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
  const isSelected = tr.nodes().indexOf(e.target) >= 0;

  if (!metaPressed && !isSelected) {
    // if no key pressed and the node is not selected
    // select just one
    tr.nodes([e.target]);
  } else if (metaPressed && isSelected) {
    // if we pressed keys and node was selected
    // we need to remove it from selection:
    const nodes = tr.nodes().slice(); // use slice to have new copy of array
    // remove node from array
    nodes.splice(nodes.indexOf(e.target), 1);
    tr.nodes(nodes);
  } else if (metaPressed && !isSelected) {
    // add the node into selection
    const nodes = tr.nodes().concat([e.target]);
    tr.nodes(nodes);
  }
}

function createStraightLine(id, attrs = null) {
  let color = colorInput.value;
  const group = new Konva.Group({
    name: 'line-group',
    draggable: true,
    visible: true,
    opacity: 1,
    id: 'm' + id,
  });
  group.on('mouseleave', cursorChangeLeave);
  group.on('mouseenter', cursorChangeEnter);
  if (attrs === null) {
    movingId = id;
    attrs = {
      points: [
        stage.getPointerPosition().x,
        stage.getPointerPosition().y,
        stage.getPointerPosition().x,
        stage.getPointerPosition().y,
      ],
      stroke: color,
      strokeWidth: 2,
      // lineCap: 'round',
      // lineJoin: 'round',
      name: 'line',

      //   draggable: true,
    };
  }

  const newLine = new Konva.Line(attrs);
  group.add(newLine);

  function updateLine() {
    let anchors = group.find('.line-anchor');
    let newpoints = anchors.map((anch) => [anch.x(), anch.y()]);
    newLine.points(newpoints.flat());
  }

  for (let i = 0; i < attrs.points.length; i += 2) {
    const element = attrs.points[i];
    const anchor = new Konva.Circle({
      x: attrs.points[i],
      y: attrs.points[i + 1],
      radius: 5,
      fill: '#526D82',
      draggable: true,
      name: 'line-anchor',
      visible: false,
    });
    group.add(anchor);
    anchor.on('dragmove', updateLine);
  }
  group.on('dragstart', cursorChangeDragstart);
  group.on('dragend', () => {
    let points = newLine.points().slice();
    // reset scale, so only with is changing by transformer
    let newpoints = [];
    let anchors = group.find('.line-anchor');

    for (let index = 0; index < points.length; index += 2) {
      const { x, y } = group
        .getAbsoluteTransform()
        .point({ x: points[index], y: points[index + 1] });
      newpoints.push(x, y);
      anchors[index / 2].setAttrs({ x, y });
    }
    group.setAttrs({ x: 0, y: 0 });
    newLine.points(newpoints);
    cursorChangeDragEnd();
  });

  layer.add(group);

  newLine.on('dragstart', cursorChangeDragstart);
  newLine.on('dragmove', function (e) {
    let points = newLine.points().slice();
    // let newpoints = [];
    let anchors = group.find('.line-anchor');

    for (let index = 0; index < points.length; index += 2) {
      const { x, y } = newLine
        .getAbsoluteTransform()
        .point({ x: points[index], y: points[index + 1] });
      // newpoints.push(x,y);
      anchors[index / 2].setAttrs({ x, y });
    }
  });
  newLine.on('dragend', function (e) {
    let points = newLine.points().slice();
    // reset scale, so only with is changing by transformer
    let newpoints = [];
    let anchors = group.find('.line-anchor');

    for (let index = 0; index < points.length; index += 2) {
      const { x, y } = newLine
        .getAbsoluteTransform()
        .point({ x: points[index], y: points[index + 1] });
      newpoints.push(x, y);
      anchors[index / 2].setAttrs({ x, y });
    }
    newLine.setAttrs({ x: 0, y: 0 });
    newLine.points(newpoints);
    // layer.draw();
    cursorChangeDragEnd(e);
  });
  newLine.on('transform', function () {
    let points = newLine.points().slice();
    let anchors = group.find('.line-anchor');

    //   // reset scale, so only with is changing by transformer
    let newpoints = [];
    for (let index = 0; index < points.length; index += 2) {
      const { x, y } = newLine
        .getAbsoluteTransform()
        .point({ x: points[index], y: points[index + 1] });
      newpoints.push(x, y);
      anchors[index / 2].setAttrs({ x, y });
    }
    newLine.points(newpoints);
    newLine.setAttrs({ x: 0, y: 0 });

    newLine.scaleX(1);
    newLine.scaleY(1);
  });
  newLine.on('transformend', function () {
    let points = newLine.points().slice();
    let anchors = group.find('.line-anchor');

    //   // reset scale, so only with is changing by transformer
    let newpoints = [];
    for (let index = 0; index < points.length; index += 2) {
      const { x, y } = newLine
        .getAbsoluteTransform()
        .point({ x: points[index], y: points[index + 1] });
      newpoints.push(x, y);
      anchors[index / 2].setAttrs({ x, y });
    }
    newLine.points(newpoints);
    newLine.setAttrs({ x: 0, y: 0 });
    newLine.scaleX(1);
    newLine.scaleY(1);
  });
}
function createRectangle(id, attrs = null) {
  if (attrs === null) {
    movingId = id;
    let color = colorInput.value;

    attrs = {
      x: stage.getPointerPosition().x,
      y: stage.getPointerPosition().y,
      width: 0,
      height: 0,
      fill: color,
      name: 'rect',
      id: 'm' + id,
      draggable: true,
    };
  } else {
    attrs['id'] = 'm' + id;
  }
  let newrect = new Konva.Rect(attrs);
  newrect.on('transformend', function () {
    newrect.setAttrs({
      width: newrect.width() * newrect.scaleX(),
      height: newrect.height() * newrect.scaleY(),
      scaleX: 1,
      scaleY: 1,
    });
  });
  newrect.on('mouseenter', cursorChangeEnter);
  newrect.on('mouseleave', cursorChangeLeave);
  newrect.on('dragstart', cursorChangeDragstart);
  newrect.on('dragend', cursorChangeDragEnd);
  layer.add(newrect);
}
function createText(id, attrs = null) {
  let color = colorInput.value;
  if (attrs === null) {
    movingId = id;

    attrs = {
      text: 'Double click to edit',
      x: x2,
      y: y2,
      fontSize: 40,
      fontFamily: 'JetBrains Mono',
      draggable: true,
      // width: 200,
      // height:40,
      fill: color,
      name: 'text',
      id: 'm' + id,
      alignment: getCurrentAlignment(),
    };
  } else {
    attrs['id'] = 'm' + id;
    attrs['fontSize'] = 40;
    attrs['fontFamily'] = 'JetBrains Mono';
  }
  var textNode = new Konva.Text(attrs);
  layer.add(textNode);

  textNode.on('transform', function () {
    //   // reset scale, so only with is changing by transformer
    textNode.setAttrs({
      // width: textNode.width() * textNode.scaleX(),
      // height: textNode.height() * textNode.scaleY(),
      scaleX: 1,
      scaleY: 1,
    });
  });
  textNode.on('transformend', function () {
    // default top left
    textNode.setAttrs(calculateOffset(textNode));
  });
  textNode.setAttrs(calculateOffset(textNode));
  textNode.on('dragstart', cursorChangeDragstart);
  textNode.on('dragend', cursorChangeDragEnd);
  textNode.on('mouseenter', cursorChangeEnter);
  textNode.on('mouseleave', cursorChangeLeave);
  textNode.on('dblclick dbltap', () => {
    let textPosition = textNode.getAbsolutePosition();
    let stageBox = stage.container().getBoundingClientRect();
    let areaPosition = {
      x: stageBox.left + textPosition.x - textNode.offsetX(),
      y: stageBox.top + textPosition.y - textNode.offsetY(),
    };

    let textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = textNode.text();
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y - 1.5 + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = 'fit-content';
    textarea.style.height =
      textNode.height() - textNode.padding() * 2 + 5 + 'px';
    textarea.style.fontSize = textNode.fontSize() + 'px';
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = textNode.lineHeight();
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.transformOrigin = 'left top';
    textarea.style.textAlign = textNode.align();
    textarea.style.color = textNode.fill();
    rotation = textNode.rotation();
    let transform = '';
    if (rotation) {
      transform += 'rotateZ(' + rotation + 'deg)';
    }

    let px = 0;
    // also we need to slightly move textarea on firefox
    // because it jumps a bit
    let isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    if (isFirefox) {
      px += 2 + Math.round(textNode.fontSize() / 20);
    }
    transform += 'translateY(-' + px + 'px)';

    textarea.style.transform = transform;

    // reset height
    textarea.style.height = 'auto';
    // after browsers resized it we can set actual value
    textarea.style.height = textarea.scrollHeight + 3 + 'px';
    tr.hide();
    textarea.focus();
    textNode.hide();
    function removeTextarea() {
      textarea.parentNode.removeChild(textarea);
      window.removeEventListener('click', handleOutsideClick);
      textNode.show();
      tr.show();
      tr.forceUpdate();
      sendUIData();
    }

    function setTextareaWidth(newWidth) {
      if (!newWidth) {
        // set width for placeholder
        newWidth = textNode.placeholder.length * textNode.fontSize();
      }
      // some extra fixes on different browsers
      let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      let isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
      if (isSafari || isFirefox) {
        newWidth = Math.ceil(newWidth);
      }

      let isEdge = document.documentMode || /Edge/.test(navigator.userAgent);
      if (isEdge) {
        newWidth += 1;
      }
      textarea.style.width = newWidth + 'px';
    }

    textarea.addEventListener('keydown', function (e) {
      // hide on enter
      // but don't hide on shift + enter
      if (e.key === 'Enter' && !e.shiftKey) {
        textNode.text(textarea.value);
        removeTextarea();
      }
      // on esc do not set value back to node
      if (e.key === 'Escape') {
        removeTextarea();
      }
    });

    textarea.addEventListener('keydown', function (e) {
      scale = textNode.getAbsoluteScale().x;
      // setTextareaWidth(textNode.width() * scale);
      textarea.style.height = 'auto';
      textarea.style.height =
        textarea.scrollHeight + textNode.fontSize() + 'px';
    });

    function handleOutsideClick(e) {
      yk;
      if (e.target !== textarea) {
        textNode.text(textarea.value);
        removeTextarea();
      }
    }
    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    });
  });
  // textNode.dblclick();
  movingId = null;
  // currentSelection = null;
}

stage.on('dragmoveend', sendUIData);
stage.on('dragmove', sendUIData);
stage.on('transformend', sendUIData);
stage.on('transform', sendUIData);

function sendUIData() {
  debounce(function () {
    let data = stage.find('.line,.rect,.text,.polyline,.polygone');

    // console.log(data);
    let dataToUpdate = data.map((d) => {
      let attrs = d.getAttrs();
      return attrs;
    });
    if (liveUpdate) {
      vscode.postMessage(dataToUpdate);
    }
  }, 1000)();
}
// stage.click();

async function isFontReady() {
  let ready = await document.fonts.ready;
  return ready;
}
function cursorChangeLeave(e) {
  if (currentSelection === null) {
    stage.container().style.cursor = 'default';
  }
  if (selectionRectangle.visible()) {
    stage.container().style.cursor = 'crosshair';
  }
}

function cursorChangeEnter(e) {
  if (currentSelection === null) {
    stage.container().style.cursor = 'pointer';
  }
  if (selectionRectangle.visible()) {
    stage.container().style.cursor = 'crosshair';
  }
}
function cursorChangeDragstart(e) {
  stage.container().style.cursor = 'move';
}
function cursorChangeDragEnd(e) {
  stage.container().style.cursor = 'pointer';
}

function calculateOffset(textNode) {
  let align = textNode.getAttrs().alignment;
  let offsetAttrs = {
    offsetY: 0,
    offsetX: 0,
  };

  if (!align) {
    return;
  }
  const [vertical, hoizon] = align.split('_');
  switch (hoizon) {
    case 'LEFT':
      offsetAttrs.offsetX = 0;
      break;
    case 'CENTER':
      offsetAttrs.offsetX = Math.floor(textNode.width() / 2);
      break;
    case 'RIGHT':
      offsetAttrs.offsetX = Math.floor(textNode.width());
      break;
    default:
      break;
  }
  switch (vertical) {
    case 'TOP':
      offsetAttrs.offsetY = 0;
      break;
    case 'MIDDLE':
      offsetAttrs.offsetY = Math.floor(textNode.height() / 2);
      break;
    case 'BOTTOM':
      offsetAttrs.offsetY = Math.floor(textNode.height());
      break;
    default:
      break;
  }
  return offsetAttrs;
}
// for zoom and scroll

var scaleBy = 1.01;
stage.on('wheel', (e) => {
  // stop default scrolling
  e.evt.preventDefault();

  var oldScale = stage.scaleX();
  var pointer = stage.getPointerPosition();

  var mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  // how to scale? Zoom in? Or zoom out?
  let direction = e.evt.deltaY > 0 ? 1 : -1;

  // when we zoom on trackpad, e.evt.ctrlKey is true
  // in that case lets revert direction
  if (e.evt.ctrlKey) {
    direction = -direction;
  }

  var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

  stage.scale({ x: newScale, y: newScale });

  var newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stage.position(newPos);
});

function updateColor(color, colorname = false) {
  tr.nodes().forEach((node) => {
    if (node.name() === 'line-group') {
      let nd =
        node.findOne('.line') ||
        node.findOne('.polyline') ||
        node.findOne('.polygone');
      // node.findOne('.line')?.stroke(color);
      // node.findOne('.polyline')?.stroke(color);
      // node.findOne('.polygone')?.fill(color);
      nd.stroke(color);
      nd.fill(color);
      nd.setAttrs({ colorname });
    } else if (['line', 'polyline'].includes(node.name())) {
      node.stroke(color);
      node.setAttrs({ colorname });
    } else if (node.name() === 'polygone') {
      node.fill(color);
      node.stroke(color);
    } else {
      node.fill(color);
    }
  });
  stage.find('.line,.polyline').forEach((l) => {
    if (l.getParent().find('.line-anchor')[0].visible()) {
      l.stroke(color);
      l.setAttrs({ colorname });
    }
  });
  stage.find('.polygone').forEach((l) => {
    if (l.getParent().find('.line-anchor')[0].visible()) {
      l.fill(color);
      l.stroke(color);
      l.setAttrs({ colorname });
    }
  });
}
