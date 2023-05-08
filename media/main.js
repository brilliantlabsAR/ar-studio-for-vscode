// let h1 = document.querySelector("h1");
const vscode = acquireVsCodeApi();
// h1.addEventListener('click',handleClick);
// function handleClick() {
//     h1.innerHTML = "Updated";
//     vscode.postMessage({
//       command: "hello",
//       text: "Hey",
//     });
// }

var width = 640;
var height = 400;
const rectbutton = document.getElementById('rect');
const straightLine =document.getElementById('straightLine') ; // add a variable for staraight  line 
const deleteButton = document.getElementById('delete');
var currentSelection = null;

rectbutton.addEventListener('click',()=>{
    currentSelection = "RECT";
});

straightLine.addEventListener('click',()=>{
  currentSelection = "STARIGHTLINE";
});
deleteButton.addEventListener('click',()=>{
    // console.log(tr);
    // layer.draw();
});
var stage = new Konva.Stage({
  container: 'container',
  width: width,
  height: height,
});

var layer = new Konva.Layer();
stage.add(layer);

var tr = new Konva.Transformer();
layer.add(tr);

// add a new feature, lets add ability to draw selection rectangle
var selectionRectangle = new Konva.Rect({
  fill: 'rgba(255,255,255,0.5)',
  visible: false,
});
layer.add(selectionRectangle);

// add a new feature, lets add ability to draw selection straightLine


var redLine = new Konva.Line({
  points: [5, 70, 140, 23, 250, 60, 300, 20],
  stroke: 'red',
  strokeWidth: 15,
  lineCap: 'round',
  lineJoin: 'round',
});

layer.add(redLine);




var x1, y1, x2, y2;
let ALL_OBJECTS = {};
let movingId = null;






stage.on('mousedown touchstart', (e) => {
  // do nothing if we mousedown on any shape
  if (e.target !== stage) {
    return;
  }
  e.evt.preventDefault();
  if(currentSelection==="RECT"){
    let id = new Date().valueOf();
    let newrect = new Konva.Rect({
      x: stage.getPointerPosition().x,
      y: stage.getPointerPosition().y,
      width: 0,
      height: 0,
      fill: 'red',
      name: 'rect',
      draggable: true,
    });
    ALL_OBJECTS[id] = newrect;
    movingId  =  id;
    layer.add(newrect);
    currentSelection =null;
  }

  if(currentSelection==="STARIGHTLINE"){
    let id = new Date().valueOf();
    var newLine = new Konva.Line({
      points: [5, 70, 140, 23],
      stroke: 'red',
      strokeWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
    });
    ALL_OBJECTS[id] = newLine;
    movingId  =  id;
    layer.add(newLine);
    currentSelection =null;
  }

  x1 = stage.getPointerPosition().x;
  y1 = stage.getPointerPosition().y;
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;

  selectionRectangle.visible(true);
  selectionRectangle.width(0);
  selectionRectangle.height(0);
});

stage.on('mousemove touchmove', (e) => {
  // do nothing if we didn't start selection
  if (!selectionRectangle.visible()) {
    return;
  }
  e.evt.preventDefault();
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;
  if(movingId){
    ALL_OBJECTS[movingId].setAttrs({
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    });
  }
  

  selectionRectangle.setAttrs({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  });
});

stage.on('mouseup touchend', (e) => {
  // do nothing if we didn't start selection
  if (!selectionRectangle.visible()) {
    return;
  }
  e.evt.preventDefault();
  // update visibility in timeout, so we can check it in click event
  setTimeout(() => {
    selectionRectangle.visible(false);
  });
  if(movingId){
    tr.nodes([ALL_OBJECTS[movingId]]);
    vscode.postMessage(ALL_OBJECTS[movingId].getAttrs());
    movingId =null;
    return;
  }
  var shapes = stage.find('.rect');
  var box = selectionRectangle.getClientRect();
  var selected = shapes.filter((shape) =>
    Konva.Util.haveIntersection(box, shape.getClientRect())
  );
  tr.nodes(selected);
});

// clicks should select/deselect shapes
stage.on('click tap', function (e) {
  // if we are selecting with rect, do nothing
  if (selectionRectangle.visible()) {
    return;
  }

  // if click on empty area - remove all selections
  if (e.target === stage) {
    tr.nodes([]);
    return;
  }
console.log(e);
  // do nothing if clicked NOT on our rectangles
  if (!e.target.hasName('rect')) {
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
});

stage.on('delete',function(){

});