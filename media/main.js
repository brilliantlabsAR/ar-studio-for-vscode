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
const ANCHORS = ['top-left','top-right', 'bottom-left',  'bottom-right','top-center',  'bottom-center', 'middle-right', 'middle-left'];
const shapeBtns =document.querySelectorAll('.shape-btn') ; // add a variable for staraight  line 
const colorInput = document.getElementById('colorselection')
const deleteButton = document.getElementById('delete');
const ArrowKeys = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"]
var currentSelection = null;
const DELTA = 4;

window.addEventListener('keydown', function(event) {
  const key = event.key; // const {key} = event; ES6+
  if(event.ctrlKey && (key =='a'|| key=='A')){
    let shapes = stage.find('.rect,.line,.text');
    if(shapes.length===1 && shapes[0].name()==='line'){
      shapes[0].getParent().find('.line-anchor').forEach(la=>{
          la.visible(true);
      });
    }else{
      tr.nodes(shapes);
    }
    return;
  }
  let offset = DELTA;
  if(event.ctrlKey && ArrowKeys.includes(key)){
    offset = 1;
  }
  if(key==="ArrowLeft"){
    tr.nodes().forEach(node=>{
      node.x(node.x() - offset);
    });
  }
  if(key==="ArrowRight"){
    tr.nodes().forEach(node=>{
      node.x(node.x() + offset);
    });
  }
  if(key=="ArrowUp"){
    tr.nodes().forEach(node=>{
      node.y(node.y() - offset);
    });
  }
  if(key=="ArrowDown"){
    tr.nodes().forEach(node=>{
      node.y(node.y() + offset);
    });
  }
  if (key === "Backspace" || key === "Delete") {
    // if(tr.nodes().length>0){

      deleteSelected();
    // }
  }
});
shapeBtns.forEach(btn=>{
  btn.addEventListener('click',function(){
    currentSelection = btn.value
    btn.classList.add('active')
  })
})

colorInput.addEventListener('change',function(){
  let color =  this.value
  tr.nodes().forEach(node=>{
    if(node.name()=='line-group'){
      node.findOne('.line').stroke(color)
    }else if(node.name()=='line'){
      node.stroke(color)
    }else{
      node.fill(color)

    }
  })
  stage.find('.line').forEach(l=>{
    if(l.getParent().find('.line-anchor')[0].visible()){
        l.stroke(color);
    }
  })
})


function deleteSelected(){
  tr.nodes().forEach(node=>{
    node.destroy();
  });
  tr.nodes([]);
  stage.find('.line').forEach(l=>{
    if(l.getParent().find('.line-anchor')[0].visible()){
        l.getParent().destroy();
    }
  })
  layer.draw();
}
deleteButton.addEventListener('click',deleteSelected);

var stage = new Konva.Stage({
  container: 'container',
  width: width,
  height: height,
});

var layer = new Konva.Layer();
stage.add(layer);

const tr = new Konva.Transformer({
  anchorFill: 'blue',
  anchorSize: 10,
  borderDash: [3, 3],
  anchorStrokeWidth : 0,
  enabledAnchors: ANCHORS.splice(0,4),
  keepRatio: false,
  rotateAnchorOffset: 30,
  rotateEnabled: false
});
tr.anchorCornerRadius(5);
layer.add(tr);
stage.getContainer().style.backgroundColor = 'rgb(0, 0, 0)';
// add a new feature, lets add ability to draw selection rectangle
var selectionRectangle = new Konva.Rect({
  // fill: 'rgba(255,255,255,0.5)',
  stroke:'blue',
  strokeWidth: 1,
  dash: [3,3],
  visible: false,
});
layer.add(selectionRectangle);


var x1, y1, x2, y2;
let line_anchors = {};
let movingId = null;

stage.on('mousedown touchstart', (e) => {
  // do nothing if we mousedown on any shape
  if (e.target !== stage) {
    return;
  }
  e.evt.preventDefault();
  x1 = stage.getPointerPosition().x;
  y1 = stage.getPointerPosition().y;
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;

  selectionRectangle.width(0);
  selectionRectangle.height(0);
  const id = new Date().valueOf();
  document.querySelector('.shape-btn[value="'+currentSelection+'"')?.classList.remove('active')
  if(currentSelection==="RECT"){
    createRectangle(id)
    
    currentSelection =null;
    // selectionRectangle.visible(true);

  }

  if(currentSelection==="STARIGHTLINE"){
    
    createStraightLine(id)
    currentSelection =null;
    // selectionRectangle.visible(true);

  }

  if(currentSelection==="ADDTEXT"){
    createText(id)
    currentSelection =null;

  }
  tr.moveToTop()
  selectionRectangle.visible(true);

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
    const shp = stage.findOne('#m'+movingId);
    if(['rect','text'].includes(shp.name())){
      shp.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    }else if(shp.name()==='line-group'){
      const line = shp.findOne('.line')
      const points = line.points().slice();
      points[2] = x2;
      points[3] = y2;
      line.points(points);
      line_anchors[movingId][1].setAttrs({
        x:x2,
        y:y2
      });
    }
    
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
    const shp = stage.findOne('#m'+movingId);
    if(shp.name()!=='line-group'){
        tr.nodes([shp]);
    }
    // vscode.postMessage(ALL_OBJECTS[movingId].getAttrs());
    movingId =null;
    // selectionRectangle.visible(false);
    
    return;
  }
  let shapes = stage.find('.rect,.line,.text');
  let box = selectionRectangle.getClientRect();
  let selected = shapes.filter((shape) =>
    Konva.Util.haveIntersection(box, shape.getClientRect())
  );
  if(selected.length===1 && selected[0].name()==='line'){
    selected[0].getParent().find('.line-anchor').forEach(la=>{
        la.visible(true);
    });
  }else{
    tr.nodes(selected);
  }
  
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
    stage.find('.line-anchor').forEach(la=>{
        la.visible(false);
      });
    return;
  }
// console.log(e);
  // do nothing if clicked NOT on our rectangles
  if (['line','line-group','line-anchor'].includes(e.target.name())) {
    // console.log(e)
    if(e.target.name()==='line-group'){
      e.target.find('.line-anchor').forEach(la=>{
        la.visible(true);
      });
    }else{
      e.target.getParent().find('.line-anchor').forEach(la=>{
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
});


function createStraightLine(id){
  let color = colorInput.value
  const group = new Konva.Group({name: 'line-group', draggable: true, visible:true,opacity:1,id: "m"+id})
    const newLine = new Konva.Line({
      points: [stage.getPointerPosition().x, stage.getPointerPosition().y,stage.getPointerPosition().x, stage.getPointerPosition().y],
      stroke: color,
      strokeWidth: 2,
      // lineCap: 'round',
      // lineJoin: 'round',
      name: 'line',
      
    //   draggable: true,
    });
    
    // layer.add(newLine);
    const anchor1 = new Konva.Circle({
        x: newLine.points()[0],
        y: newLine.points()[1],
        radius: 5,
        fill: 'blue',
        draggable: true,
        name:'line-anchor'
      });
    //   layer.add(anchor1);
      
      const anchor2 = anchor1.clone({x: newLine.points()[2], y: newLine.points()[3],});
    //   layer.add(anchor2);
     group.add(newLine, anchor1, anchor2);
     layer.add(group);
      
      function updateLine() {
        const points = [
          anchor1.x(),
          anchor1.y(),
          anchor2.x(),
          anchor2.y(),
        ];
        newLine.points(points);
        // layer.batchDraw();
      }
      
      anchor1.on('dragmove', updateLine);
      anchor2.on('dragmove', updateLine);
      newLine.on("dragmove",function(e){
        let points =  newLine.points().slice();
         // reset scale, so only with is changing by transformer
         let p1 = newLine.getAbsoluteTransform().point({ x: points[0], y: points[1]});
         let p2 = newLine.getAbsoluteTransform().point({ x: points[2], y: points[3]});

          anchor1.setAttrs(p1);
          anchor2.setAttrs(p2);
      // layer.draw();


      });
      newLine.on("dragend",function(e){
        let points =  newLine.points().slice();
         // reset scale, so only with is changing by transformer
         let p1 = newLine.getAbsoluteTransform().point({ x: points[0], y: points[1]});
         let p2 = newLine.getAbsoluteTransform().point({ x: points[2], y: points[3]});

          anchor1.setAttrs(p1);
          anchor2.setAttrs(p2);
          newLine.setAttrs({x:0,y:0})
          newLine.points([p1.x, p1.y, p2.x, p2.y])
          // layer.draw();

      });
      movingId  =  id;
      line_anchors[movingId] = [anchor1,anchor2];
      layer.draw();
    // group.on('dblclick',()=>{
    //     tr.nodes([group]);
    // });
    newLine.on('transform', function () {
      let points =  newLine.points().slice();
      //   // reset scale, so only with is changing by transformer
       let p1 = newLine.getAbsoluteTransform().point({ x: points[0], y: points[1]});
       let p2 = newLine.getAbsoluteTransform().point({ x: points[2], y: points[3]});
        anchor1.setAttrs(p1);
        anchor2.setAttrs(p2);
        newLine.setAttrs({x:0,y:0})
        newLine.points([p1.x, p1.y, p2.x, p2.y])
        newLine.scaleX(1);
        newLine.scaleY(1);

      });
      newLine.on('transformend', function () {
        let points =  newLine.points().slice();
        //   // reset scale, so only with is changing by transformer
         let p1 = newLine.getAbsoluteTransform().point({ x: points[0], y: points[1]});
         let p2 = newLine.getAbsoluteTransform().point({ x: points[2], y: points[3]});
          anchor1.setAttrs(p1);
          anchor2.setAttrs(p2);
          newLine.setAttrs({x:0,y:0})
          newLine.points([p1.x, p1.y, p2.x, p2.y])
          newLine.scaleX(1);
          newLine.scaleY(1);

        });
}
function createRectangle(id){
  let color = colorInput.value

  let newrect = new Konva.Rect({
    x: stage.getPointerPosition().x,
    y: stage.getPointerPosition().y,
    width: 0,
    height: 0,
    fill: color,
    name: 'rect',
    id: "m"+id,
    draggable: true,
  });
  movingId  =  id;
  layer.add(newrect);
}
function createText(id){
  let color = colorInput.value

  var textNode = new Konva.Text({
    text: 'welcome',
    x: x2,
    y: y2,
    fontSize: 20,
    fontFamily: 'JetBrains Mono',
    draggable: true,
    width: 200,
    fill: color,
    name: "text",
    id: "m"+id
  });
  movingId  =  id;
  layer.add(textNode);



  textNode.on('transform', function () {
  //   // reset scale, so only with is changing by transformer
    textNode.setAttrs({
      width: textNode.width() * textNode.scaleX(),
      height: textNode.height() * textNode.scaleY(),
      scaleX: 1,
      scaleY: 1,
    });
  });


  textNode.on('dblclick dbltap', () => {
    let textPosition = textNode.getAbsolutePosition();
    let stageBox = stage.container().getBoundingClientRect();
    let areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    };

    let textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = textNode.text();
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y - 1.5 + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = textNode.width() - textNode.padding() * 2 + 'px';
    textarea.style.height = textNode.height() - textNode.padding() * 2 + 5 + 'px';
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
    let isFirefox =
      navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    if (isFirefox) {
      px += 2 + Math.round(textNode.fontSize() / 20);
    }
    transform += 'translateY(-' + px + 'px)';

    textarea.style.transform = transform;

    // reset height
    textarea.style.height = 'auto';
    // after browsers resized it we can set actual value
    textarea.style.height = textarea.scrollHeight + 3 + 'px';

    textarea.focus();
    textNode.hide()
    function removeTextarea() {
      textarea.parentNode.removeChild(textarea);
      window.removeEventListener('click', handleOutsideClick);
      textNode.show();
      tr.show();
      tr.forceUpdate();
    }

    function setTextareaWidth(newWidth) {
      if (!newWidth) {
        // set width for placeholder
        newWidth = textNode.placeholder.length * textNode.fontSize();
      }
      // some extra fixes on different browsers
      let isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );
      let isFirefox =
        navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
      if (isSafari || isFirefox) {
        newWidth = Math.ceil(newWidth);
      }

      let isEdge =
        document.documentMode || /Edge/.test(navigator.userAgent);
      if (isEdge) {
        newWidth += 1;
      }
      textarea.style.width = newWidth + 'px';
    }

    textarea.addEventListener('keydown', function (e) {
      // hide on enter
      // but don't hide on shift + enter
      if (e.keyCode === 13 && !e.shiftKey) {
        textNode.text(textarea.value);
        removeTextarea();
      }
      // on esc do not set value back to node
      if (e.keyCode === 27) {
        removeTextarea();
      }
    });

    textarea.addEventListener('keydown', function (e) {
      scale = textNode.getAbsoluteScale().x;
      setTextareaWidth(textNode.width() * scale);
      textarea.style.height = 'auto';
      textarea.style.height =
        textarea.scrollHeight + textNode.fontSize() + 'px';
    });

    function handleOutsideClick(e) {
      if (e.target !== textarea) {
        textNode.text(textarea.value);
        removeTextarea();
      }
    }
    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    });
  });
}