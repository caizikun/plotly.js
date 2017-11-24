/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var colorAttrs = require('../../components/color/attributes');
var axesAttrs = require('../cartesian/layout_attributes');
var extendFlat = require('../../lib').extendFlat;

var domainItem = {
    valType: 'info_array',
    role: 'info',
    editType: 'plot',
    items: [
        {valType: 'number', min: 0, max: 1},
        {valType: 'number', min: 0, max: 1}
    ],
    dflt: [0, 1]
};

var positionItem = {
    valType: 'number',
    role: 'info',
    editType: 'plot',
    min: -2,
    max: 3
};

var axisStyleAttrs = {
    // not sure about these
    // maybe just for radialaxis ??
    // title: axesAttrs.title,
    // titlefont: axesAttrs.titlefont,

    visible: extendFlat({}, axesAttrs.visible, {dflt: true}),
    color: axesAttrs.color,
    tickmode: axesAttrs.tickmode,
    nticks: extendFlat({}, axesAttrs.nticks, {dflt: 6, min: 1}),
    tick0: axesAttrs.tick0,
    dtick: axesAttrs.dtick,
    tickvals: axesAttrs.tickvals,
    ticktext: axesAttrs.ticktext,
    // 'inside' / 'outside' don't make sense for radial axis
    ticks: axesAttrs.ticks,
    ticklen: axesAttrs.ticklen,
    tickwidth: axesAttrs.tickwidth,
    tickcolor: axesAttrs.tickcolor,
    showticklabels: axesAttrs.showticklabels,
    showtickprefix: axesAttrs.showtickprefix,
    tickprefix: axesAttrs.tickprefix,
    showticksuffix: axesAttrs.showticksuffix,
    // maybe show degree symbol or $i * \pi$ by default
    ticksuffix: axesAttrs.ticksuffix,
    showexponent: axesAttrs.showexponent,
    exponentformat: axesAttrs.exponentformat,
    separatethousands: axesAttrs.separatethousands,
    tickfont: axesAttrs.tickfont,
    tickangle: axesAttrs.tickangle,
    tickformat: axesAttrs.tickformat,
    hoverformat: axesAttrs.hoverformat,

    // not sure about this one
    // tickformatstops: axesAttrs.tickformatstops,

    showline: extendFlat({}, axesAttrs.showline, {dflt: true}),
    linecolor: axesAttrs.linecolor,
    linewidth: axesAttrs.linewidth,
    showgrid: extendFlat({}, axesAttrs.showgrid, {dflt: true}),
    gridcolor: axesAttrs.gridcolor,
    gridwidth: axesAttrs.gridwidth

    // should we add zeroline* attributes?
    // might be useful on radial axes where range is negative and positive

    // we could add spike* attributes down the road
};

module.exports = {
    x: extendFlat({}, positionItem, {
        description: [
            '...'
        ].join(' ')
    }),
    y: extendFlat({}, positionItem, {
        description: [
            '...'
        ].join(' ')
    }),
    zoom: {
        valType: 'number',
        role: 'info',
        editType: 'plot',
        min: 0,
        dflt: 1,
        description: ''
    },
    domain: {
        x: extendFlat({}, domainItem, {
            description: [
                'Sets the horizontal domain of this subplot',
                '(in plot fraction).'
            ].join(' ')
        }),
        y: extendFlat({}, domainItem, {
            description: [
                'Sets the vertical domain of this subplot',
                '(in plot fraction).'
            ].join(' ')
        }),
        editType: 'plot'
    },

    radialaxis: extendFlat({
        type: axesAttrs.type,
        autorange: axesAttrs.autorange,
        // might make 'nonnegative' to default
        rangemode: axesAttrs.rangemode,
        range: axesAttrs.range,
        categoryorder: axesAttrs.categoryorder,
        categoryarray: axesAttrs.categoryarray,
        calendar: axesAttrs.calendar,

        // or angle, angleoffset? (but should support any data coordinate system)
        position: {
            valType: 'any',
            editType: 'plot',
            role: 'info',
            description: [
                '...'
            ].join(' ')
        },
        side: {
            valType: 'enumerated',
            values: ['left', 'right'],
            dflt: 'right',
            editType: 'plot',
            role: 'info',
            description: [
                '...'
            ].join(' ')
        },

        // N.B. the radialaxis grid lines are circular

        // only applies to radial axis for now (i.e. for cliponaxis: false traces)
        // but angular.layer could be a thing later
        layer: axesAttrs.layer,

        // hmm maybe range should be a 'max' instead
        // so that always starts at 0?
        // -> mpl allow radial ranges to start off 0
        // -> same for matlab: https://www.mathworks.com/help/matlab/ref/rlim.html

        // do we need some attribute that determines the span
        // to draw donut-like charts
        // e.g. https://github.com/matplotlib/matplotlib/issues/4217
        //
        // maybe something like
        // span: {},

        // maybe should add a boolean to enable square grid lines
        // and square axis lines
        // (most common in radar-like charts)
        // e.g. squareline/squaregrid or showline/showgrid: 'square' (on-top of true)

        editType: 'calc'
    }, axisStyleAttrs),

    angularaxis: extendFlat({
        type: {
            valType: 'enumerated',
            // no 'log' for now
            values: ['-', 'linear', 'date', 'category'],
            dflt: '-',
            role: 'info',
            editType: 'calc',
            description: [
                ''
            ].join(' ')
        },

        categoryorder: axesAttrs.categoryorder,
        categoryarray: axesAttrs.categoryarray,
        calendar: axesAttrs.calendar,

        start: {
            valType: 'any',
            // similar to tick0

            // defaults to 2*pi for linear
            //
        },

        period: {
            valType: 'any'

            // defaults to 2*pi for linear
            // and to full range for other types

            // similar to dtick
            // to achieve e.g.:
            // - period that equals the timeseries length
            //  http://flowingdata.com/2017/01/24/one-dataset-visualized-25-ways/18-polar-coordinates/
            // - and 1-year periods (focusing on seasonal change0
            //  http://otexts.org/fpp2/seasonal-plots.html
            //  http://www.seasonaladjustment.com/2012/09/05/clock-plot-visualising-seasonality-using-r-and-ggplot2-part-3/
        },

        thetaunit: {
            valType: 'enumerated',
            values: ['radians', 'degrees', 'gradians'],
            dflt: 'radians',
            role: 'info',
            editType: 'calc+clearAxisTypes',
            description: [
                'Sets the format unit of the formatted *theta* values.',
                'Has an effect only when `angularaxis.type` is *linear*.'
            ].join(' ')
        },

        // should angularaxis.range correspond to
        // angular span of the drawing area?
        // or the length of the period (i.e. dflt: 360 degree)
        //
        // matlab's angular equivalent to 'range' bounds the drawing area
        // (partial circles as they call it)
        // https://www.mathworks.com/help/matlab/ref/thetalim.html
        //
        // maybe something like (to not confuse)
        // span: {},

        editType: 'calc'
    }, axisStyleAttrs),

    bgcolor: {
        valType: 'color',
        role: 'style',
        editType: 'style',
        dflt: colorAttrs.background,
        description: 'Set the background color of the subplot'
    },

    direction: {
        valType: 'enumerated',
        values: ['clockwise', 'counterclockwise'],
        role: 'info',
        description: [
            'Sets the direction corresponding to positive angles.'
        ].join(' ')
    },

    // used to be 'orientation' in legacy polar
    rotation: {
        valType: 'angle',
        role: 'info',
        description: [
            'Rotates the entire polar by the given angle.'
        ].join(' ')
    },

    // TODO maybe?
    // annotations:
};
