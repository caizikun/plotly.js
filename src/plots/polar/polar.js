/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var d3 = require('d3');
var tinycolor = require('tinycolor2');

var Plotly = require('../../plotly');
var Lib = require('../../lib');
var Color = require('../../components/color');
var Drawing = require('../../components/drawing');
var Plots = require('../plots');
var Axes = require('../cartesian/axes');
var dragElement = require('../../components/dragelement');
var dragBox = require('../cartesian/dragbox');
var setCursor = require('../../lib/setcursor');
var Fx = require('../../components/fx');
var prepSelect = require('../cartesian/select');

var constants = require('./constants');
var axisNames = constants.axisNames;
var MINZOOM = constants.MINZOOM;
var MINDRAG = constants.MINDRAG;
var blankPath = 'M0,0';

function Polar(gd, id) {
    this.id = id;
    this.gd = gd;

    this.hasClipOnAxisFalse = null;
    this.traceHash = {};
    this.layers = {};
    this.clipPaths = {};

    var fullLayout = gd._fullLayout;
    var polarLayout = fullLayout[id];
    var clipId = this.clipId = 'clip' + fullLayout._uid + id;

    this.clipPaths.circle = fullLayout._clips.append('clipPath')
        .attr('id', clipId + '-circle')
        .append('path');

    this.clipPaths.rect = fullLayout._clips.append('clipPath')
        .attr('id', clipId + '-rect')
        .append('rect');

    this.framework = fullLayout._polarlayer.append('g')
        .attr('class', id)
//         .call(Drawing.setClipUrl, clipId + '-rect');

    this.viewInitial = {
        x: polarLayout.x,
        y: polarLayout.y,
        zoom: polarLayout.zoom
    };

    this.xaxis = {
        type: 'linear',
        _id: 'x'
    };

    this.yaxis = {
        type: 'linear',
        _id: 'y'
    };
}

var proto = Polar.prototype;

module.exports = function createPolar(gd, id) {
    return new Polar(gd, id);
};

proto.plot = function(polarCalcData, fullLayout) {
    var _this = this;
    var polarLayout = fullLayout[_this.id];

    // TODO maybe move to generalUpdatePerTraceModule ?
    _this.hasClipOnAxisFalse = false;
    for(var i = 0; i < polarCalcData.length; i++) {
        var trace = polarCalcData[i][0].trace;

        if(trace.cliponaxis === false) {
            _this.hasClipOnAxisFalse = true;
            break;
        }
    }

    Axes.doAutoRange(polarLayout.radialaxis);

    _this.updateLayers(fullLayout, polarLayout);
    _this.updateLayout(fullLayout, polarLayout);
    _this.updateFx(fullLayout, polarLayout);
    Plots.generalUpdatePerTraceModule(_this, polarCalcData, polarLayout);
};

proto.updateLayers = function(fullLayout, polarLayout) {
    var _this = this;
    var layers = _this.layers;

    // TODO sort to implement 'radialaxis.layer' & 'angularaxis.layer
    var layerData = constants.layerNames.slice();

    var join = _this.framework.selectAll('.polarlayer')
        .data(layerData, String);

    join.enter().append('g')
        .attr('class', function(d) { return 'polarlayer ' + d})
        .each(function(d) {
            var sel = layers[d] = d3.select(this);

            switch(d) {
                case 'frontplot':
                    sel.append('g')
                        .classed('scatterlayer', true)
                        .call(Drawing.setClipUrl, _this.clipId + '-circle');
                    break;
                case 'backplot':
                    sel.append('g').classed('maplayer', true);
                    break;
                case 'plotbg':
                    layers.bgcircle = sel.append('circle');
                    break;
                case 'grids':
                    axisNames.forEach(function(d) {
                        var k = d + 'grid';
                        layers[k] = sel.append('g')
                            .classed(k, true)
                            .attr('fill', 'none');
                    });
                    break;
                case 'axes':
                    // TODO in fact, there's only one axis (the radial one)!
                    axisNames.forEach(function(d) {
                        layers[d] = sel.append('g').classed(d, true);
                    });
                    break;
                case 'lines':
                    layers.radialline = sel.append('line')
                        .classed('radialline', true)
                        .attr('fill', 'none');
                    layers.angularline = sel.append('circle')
                        .classed('angularline', true)
                        .attr('fill', 'none');
                    break;
            }
        });

    join.order();
};

proto.updateLayout = function(fullLayout, polarLayout) {
    var _this = this;
    var layers = _this.layers;
    var gs = fullLayout._size;
    var radialLayout = polarLayout.radialaxis;
    var angularLayout = polarLayout.angularaxis;

    // layout domains
    var xDomain = polarLayout.domain.x;
    var yDomain = polarLayout.domain.y;
    // offsets from paper edge to layout domain box
    var xOffset = _this.xOffset = gs.l + gs.w * xDomain[0];
    var yOffset = _this.yOffset = gs.t + gs.h * (1 - yDomain[1]);
    // lengths of the layout domain box
    var xLength = _this.xLength = gs.w * (xDomain[1] - xDomain[0]);
    var yLength = _this.yLength = gs.h * (yDomain[1] - yDomain[0]);
    // normalized coordinates of the subplot's center
    var xPos = polarLayout.x;
    var yPos = polarLayout.y;
    // px coordinates of the subplot's center
    var cx = _this.cx = gs.l + gs.w * xPos;
    var cy = _this.cy = gs.t + gs.h * (1 - yPos);
    // diameter of polar chart in px and normalized coordinates
    var diameter = _this.diameter = Math.min(xLength, yLength);
    var radius = diameter / 2;
    // actual domains of the polar chart that give a square in px coordinates
    var xDomain2 = _this.xDomain2 = [xPos - radius / gs.w, xPos + radius / gs.w];
    var yDomain2 = _this.yDomain2 = [yPos - radius / gs.h, yPos + radius / gs.h];
    // actual offsets from paper edge to the subplot box top-left corner
    var xOffset2 = _this.xOffset2 = gs.l + gs.w * xDomain2[0];
    var yOffset2 = _this.yOffset2 = gs.t + gs.h * (1 - yDomain2[1]);
    // ...
    var rRange = radialLayout.range;
    var zoom = polarLayout.zoom;
    var cartesianRange = [-rRange[1], rRange[1]];

    var xaxis = _this.xaxis;
    xaxis.range = cartesianRange.slice();
    xaxis.domain = xDomain2;
    Axes.setConvert(xaxis, fullLayout);
    xaxis.setScale();
    xaxis.isPtWithinRange = function(d) {};

    var yaxis = _this.yaxis;
    yaxis.range = cartesianRange.slice();
    yaxis.domain = yDomain2;
    Axes.setConvert(yaxis, fullLayout);
    yaxis.setScale();
    yaxis.isPtWithinRange = function() { return true; };

    // TODO might NOT need to extend layout axes into new object for subplot instance

    var radialAxis = _this.radialaxis = Lib.extendFlat({}, radialLayout, {
        _axislayer: layers.radialaxis,
        _gridlayer: layers.radialaxisgrid,
        // make this an 'x' axis to make positioning (especially rotation) easier
        _id: 'x',
        _pos: 0,
        // radialaxis uses 'top'/'bottom' -> convert to 'x' axis equivalent
        // TODO does not work!!
        side: {left: 'top', right: 'bottom'}[radialLayout.side],
        // spans 1/2 of the polar subplot
        domain: [polarLayout.x, xDomain2[1]],

        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(radialAxis, fullLayout);
    radialAxis.setScale();
    //
    radialAxis._datafn = function(d) {
        return [d.text, radialAxis.c2p(d.x), radialLayout.side].join('_');
    };
    //
    radialAxis._gridpath = function(d) {
        var r = radialAxis.c2p(d.x);
		return pathSector(r, 0, 180);
// 		return pathCircle(r);
    };
    // TODO we should need to do this
    // why does the custom keyfn does not work??
    layers.radialaxisgrid.selectAll('path').remove();
    layers.radialaxis.selectAll('.xtick').remove();
    Axes.doTicks(gd, radialAxis, true);

    // TODO maybe radial axis should be above frontplot ??

    // TODO add support for other all supported theta types
    var radialAxisAngle = _this.radialAxisAngle = radialLayout.angle === undefined ?
        0 :
        -radialLayout.angle;
    var radialTransform = stringTransform(cx, cy, radialAxisAngle);

    layers.radialaxis.attr('transform', radialTransform);
    layers.radialaxisgrid
        .attr('transform', radialTransform)
        .selectAll('path').attr('transform', null);
    layers.radialline.attr({
        display: radialLayout.showline ? null : 'none',
        x1: 0,
        y1: 0,
        x2: radius,
        y2: 0,
        transform: radialTransform
    })
    .attr('stroke-width', radialLayout.linewidth)
    .call(Color.stroke, radialLayout.linecolor);

    var angularAxis = _this.angularaxis = Lib.extendFlat({}, angularLayout, {
        // .. !!! ...
        _id: 'angular',
        _axislayer: layers.angularaxis,
        _gridlayer: layers.angularaxisgrid,
        // to get auto nticks right!
        domain: [0, Math.PI],
//         range: [0, 360],
        // ...
        side: 'right',
        zeroline: false,
        _pos: 0,

        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(angularAxis, fullLayout);
    angularAxis.setScale();
    var x2rad = angularAxis.x2rad = function(v) {
        if(angularAxis.type === 'category') {
            return v * 2 * Math.PI / angularAxis._categories.length;
        } else if(angularAxis.type === 'date') {
			var period = angularAxis.period || 365 * 24 * 60 * 60 * 1000;
			return (v % period) * 2 * Math.PI / period;
        }
        return v / 180 * Math.PI;
    }
    angularAxis._transfn = function(d) {
        var r = radialAxis.range[1];
        var theta = -x2rad(d.x);
        var x = cx + radialAxis.c2p(r * Math.cos(theta));
        var y = cy + radialAxis.c2p(r * Math.sin(theta));
        return 'translate(' + x + ',' + y + ')';
    };
    angularAxis._gridpath = function(d) {
        var r = radialAxis.range[1];
        var theta = -x2rad(d.x);
        var x = radialAxis.c2p(r * Math.cos(theta));
        var y = radialAxis.c2p(r * Math.sin(theta));
        return 'M0,0L' + [-x, -y];
    };
    Axes.doTicks(gd, angularAxis, true);

    layers.angularaxis.selectAll('path.angulartick.ticks')
        .attr('transform', function(d) {
            var baseTransform = d3.select(this).attr('transform');
            var angle = d.x;
            if(angularLayout.type !== 'linear') {
                angle = x2rad(angle) / Math.PI * 180;
            }
            return baseTransform + 'rotate(' + -angle + ')';
        });

//     layers.angularaxis.selectAll('g.ytick > text')
//         .attr('transform', function(d) {
//             var baseTransform = d3.select(this).attr('transform');
//             var angle = d.x / 400 * 360;
//             return baseTransform + 'rotate(' + angle + ')';
//         });

//     layers.angularaxis.selectAll('g.ytick')
//         .attr('transform', function(d) {
//             var r = radialAxis.range[1];
//             var theta = d.x / 200 * Math.PI;
//             var x = cx + radialAxis.c2p(r * Math.cos(theta));
//             var y = cy + radialAxis.c2p(r * Math.sin(theta));
//             var angle = d.x / 400 * 360;
//             return 'rotate(' + [angle, x, y].join(',') + ')';
//         });

//     layers.angularaxis.selectAll('.angulartick > text')
//         .text(function(d) { return d.text / 400 * 360; })
//         .each(function(d) {
//             var el = d3.select(this);
//             var theta = d.x / 200 * Math.PI;
//             var x = el.attr('x');
//             var y = el.attr('y');
//
//             el.attr('tra')
//
//             el.attr('x', x * Math.cos(theta));
//             el.attr('y', y * Math.sin(theta));
//         })

//     layers.angularaxis.selectAll('.ytick > text')
//         .text(function(d) { return d.text / 400 * 360; })
//         .attr('x', null)
//         .attr('y', null)
//         .attr('transform', function(d) {
//             var r = radialAxis.range[1];
//             var theta = d.x / 200 * Math.PI;
//             var ticklen = angularLayout.ticklen || 0;
//
//             return stringTransform(
//                 cx + radialAxis.c2p(r * Math.cos(theta)) + ticklen * Math.cos(theta),
//                 cy + radialAxis.c2p(r * Math.sin(theta)) + ticklen * Math.sin(theta)
//             );
//         });

    layers.angularline.attr({
        display: angularLayout.showline ? null : 'none',
        cx: cx,
        cy: cy,
        r: radius
    })
    .attr('stroke-width', angularLayout.linewidth)
    .call(Color.stroke, angularLayout.linecolor);

    Drawing.setTranslate(layers.frontplot, xOffset2, yOffset2);

    layers.bgcircle.attr({
        cx: cx,
        cy: cy,
        r: radius
    })
    .call(Color.fill, polarLayout.bgcolor);

    _this.clipPaths.circle
		.attr('d', pathCircle(radius))
		.attr('transform', 'translate(' + (cx - xOffset2) + ',' + (cy - yOffset2) + ')');
};

proto.updateFx = function(fullLayout, polarLayout) {
    if(!this.gd._context.staticPlot) {
        this.updateMainDrag(fullLayout, polarLayout);
        this.updateRadialDrag(fullLayout, polarLayout);
    }
};

proto.updateMainDrag = function(fullLayout, polarLayout) {
    var _this = this;
    var gd = _this.gd;
    var layers = _this.layers;
    var zoomlayer = fullLayout._zoomlayer;
    var gs = fullLayout._size;

    var mainDrag = dragBox.makeDragger(
        layers, 'maindrag', 'crosshair',
        _this.xOffset2, _this.yOffset2, _this.diameter, _this.diameter
    );

    var dragOpts = {
        element: mainDrag,
        gd: gd,
        subplot: _this.id,
        plotinfo: {
            xaxis: _this.xaxis,
            yaxis: _this.yaxis
        },
        xaxes: [_this.xaxis],
        yaxes: [_this.yaxis]
    };

    // use layout domain and offsets to shadow full subplot domain on 'zoom'
    var pw = _this.xLength;
    var ph = _this.yLength;
    var xs = _this.xOffset;
    var ys = _this.yOffset;
    var x0, y0;
    var box, path0, dimmed, lum;
    var zb, corners;

    function zoomPrep(evt, startX, startY) {
        var bbox = mainDrag.getBoundingClientRect();
        var polarLayoutNow = gd._fullLayout[_this.id];
        x0 = startX - bbox.left;
        y0 = startY - bbox.top;
        box = {l: x0, r: x0, w: 0, t: y0, b: y0, h: 0};
        lum = tinycolor(polarLayoutNow.bgcolor).getLuminance();
        path0 = 'M0,0H' + pw + 'V' + ph + 'H0V0';
        dimmed = false;

        zb = dragBox.makeZoombox(zoomlayer, lum, xs, ys, path0);
        corners = dragBox.makeCorners(zoomlayer, xs, ys);
        dragBox.clearSelect(zoomlayer);
    }

    function zoomMove(dx0, dy0) {
        var x1 = Math.max(0, Math.min(pw, dx0 + x0));
        var y1 = Math.max(0, Math.min(ph, dy0 + y0));
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);

        box.w = box.h = Math.max(dx, dy);
        var delta = box.w / 2;

        if(dx > dy) {
            box.l = Math.min(x0, x1);
            box.r = Math.max(x0, x1);
            box.t = Math.min(y0, y1) - delta;
            box.b = Math.min(y0, y1) + delta;
        } else {
            box.t = Math.min(y0, y1);
            box.b = Math.max(y0, y1);
            box.l = Math.min(x0, x1) - delta;
            box.r = Math.max(x0, x1) + delta;
        }

        dragBox.updateZoombox(zb, corners, box, path0, dimmed, lum);
        corners.attr('d', dragBox.xyCorners(box));
        dimmed = true;
    }

    function zoomDone(dragged, numClicks) {
        if(Math.min(box.h, box.w) < MINDRAG * 2) {
            if(numClicks === 2) doubleClick();
            return dragBox.removeZoombox(gd);
        }

        dragBox.removeZoombox(gd);

        // Hmm. Can I do this with zoom and x/y ??
        var updateObj = {};
        var polarUpdateObj = updateObj[_this.id] = {};
        polarUpdateObj.zoom = 1;
        polarUpdateObj.x = 0.5;
        polarUpdateObj.y = 0.5;

        Plotly.relayout(gd, polarUpdateObj);
    }

    function panMove(dx, dy) {
        var vb = [dx, dy, pw - dx, ph - dy];
        updateByViewBox(vb);
    }

    function panDone(dragged, numClicks) {
        if(dragged) {
            updateByViewBox([0, 0, pw, ph]);
        } else if(numClicks === 2) {
            doubleClick();
        }
    }

    function zoomWheel() {

    }

    function updateByViewBox(vb) {
        var ax = _this.xaxis;
        var xScaleFactor = vb[2] / ax._length;
        var yScaleFactor = vb[3] / ax._length;
        var clipDx = vb[0];
        var clipDy =  vb[1];

        var plotDx = ax._offset - clipDx / xScaleFactor;
        var plotDy = ax._offset - clipDy / yScaleFactor;

        _this.framework
            .call(Drawing.setTranslate, -plotDx, -plotDy)
//             .call(Drawing.setScale, 1 / xScaleFactor, 1 / yScaleFactor);

        _this.clipPaths.rect
            .call(Drawing.setTranslate, plotDx, plotDy);

        return
        // maybe cache this at the plot step
        var traceGroups = _this.framework.selectAll('.trace');

        traceGroups.selectAll('.point')
            .call(Drawing.setPointGroupScale, xScaleFactor, yScaleFactor);
        traceGroups.selectAll('.textpoint')
            .call(Drawing.setTextPointsScale, xScaleFactor, yScaleFactor);
        traceGroups
            .call(Drawing.hideOutsideRangePoints, _this);
    }

    function doubleClick() {
        gd.emit('plotly_doubleclick', null);
        Plotly.relayout(gd, {});
    }

    dragOpts.prepFn = function(evt, startX, startY) {
        var dragModeNow = gd._fullLayout.dragmode;

        switch(dragModeNow) {
            case 'zoom':
                dragOpts.moveFn = zoomMove;
                dragOpts.doneFn = zoomDone;
                zoomPrep(evt, startX, startY);
                break;
            case 'pan':
                dragOpts.moveFn = panMove;
                dragOpts.doneFn = panDone;
                break;
            case 'select':
            case 'lasso':
                prepSelect(evt, startX, startY, dragOpts, dragModeNow);
                break;
        }
    };

    mainDrag.onmousemove = function(evt) {
        Fx.hover(gd, evt, _this.id);
        gd._fullLayout._lasthover = mainDrag;
        gd._fullLayout._hoversubplot = _this.id;
    };

    mainDrag.onmouseout = function(evt) {
        if(gd._dragging) return;
        dragElement.unhover(gd, evt);
    };

    mainDrag.onclick = function(evt) {
        Fx.click(gd, evt, _this.id);
    };

    if(gd._context.scaleZoom) {
        dragBox.attachWheelEventHandler(mainDrag, zoomWheel);
    }

    dragElement.init(dragOpts);
};

proto.updateRadialDrag = function(fullLayout, polarLayout) {
    var _this = this;
    var gd = _this.gd;
    var layers = _this.layers;
    var radius = _this.diameter / 2;
    var angle = _this.radialAxisAngle / 180 * Math.PI;
    var bl = 50;
    var bl2 = bl / 2;
    var radialDrag = dragBox.makeDragger(layers, 'radialdrag', 'move', -bl2, -bl2, bl, bl);
    var radialDrag3 = d3.select(radialDrag);
    var dragOpts = {element: radialDrag, gd: gd};

    var bx = _this.cx + (radius + bl2) * Math.cos(angle);
    var by = _this.cy - (radius + bl2) * Math.sin(-angle);
    radialDrag3.attr('transform', 'translate(' + bx + ',' + by + ')');

    function rerangePrep(evt, startX, startY) {
        r0 = startX;
    }

    function rerangeMove(dx0) {
        _this.radialAxis.p2c()


    }

    function rerangeDone() {

    }

    var x0, y0, r;

    function rotatePrep(evt, startX, startY) {
        x0 = startX - _this.cx;
        y0 = startY - _this.cy;
    }

    function rotateMove(dx, dy) {
        var x1 = _x1 - bx;
        var y1 = _y1 - by;
        var r = Math.sqrt(x1 * x1, y1 * y1);
        var angle = Math.atan2(y1, x1) / Math.PI * 180;

//         console.log([_x1, _y1], [_this.cx, _this.cy], [x1, y1], angle)

        _this.framework.attr('transform',
            'rotate('+ angle + ',' + _this.cx + ',' + _this.cy + ')');
    };

    function rotateDone(dragged) {
        _this.framework.attr('transform', null);

//         var updateObj = {};
//         updateObj[_this.id + '.radialaxis.range[1]'] =
//         Plotly.relayout(gd, )
    };

    dragOpts.prepFn = function(evt, startX, startY) {
//         rerangePrep(evt, startX, startY);
//         dragOpts.moveFn = rerangeMove;
//         dragOpts.doneFn = rerangeDone;

        rotatePrep(evt, startX, startY);
        dragOpts.moveFn = rotateMove;
        dragOpts.doneFn = rotateDone;

        if(evt.shift) {
        } else {
        }
    };

    dragElement.init(dragOpts);
}

function pathCircle(r) {
    return Drawing.symbolFuncs[0](r);
}

function pathSector(r, start, span) {
	var start = 0
	var span = 1 * Math.PI + 0.5
	span = Math.PI
	var xs = r * Math.cos(start);
	var ys = -r * Math.sin(start);
	var xe = r * Math.cos(start + span);
	var ye = -r * Math.sin(start + span);
	var flags = span < Math.PI ? [0, 0, 0] : [0, 1, 1];

	flags = [0,0,0]
// 	flags = [1,1,1]

	return 'M' + [xs, ys]
		+ 'A' + [r, r] + ' ' + flags + ' ' + [xe, ye]
// 	return 'M' + r + ',0'
// 		+ 'A' + r + ',' + r + ' 0 1,1 ' + (-r) + ',0'
// 		+ 'A' + r + ',' + r + ' 0 0,1 ' + r + ',0Z';

}

function stringTransform(x, y, angle) {
    var str = 'translate(' + x + ',' + y + ')';
    if(angle) str += 'rotate(' + angle + ')';
    return str;
}
