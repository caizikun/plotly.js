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
var overrideAll = require('../../plot_api/edit_types').overrideAll;

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

var axisStyleAttrs = overrideAll({
    // not sure about these
    // maybe just for radialaxis ??
    // title: axesAttrs.title,
    // titlefont: axesAttrs.titlefont,

    visible: extendFlat({}, axesAttrs.visible, {dflt: true}),
    color: axesAttrs.color,
    tickmode: axesAttrs.tickmode,
    nticks: axesAttrs.nticks,
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
}, 'plot', 'from-root');

module.exports = {
    // I thought about a x/y/zoom system for paper-based zooming
    // but I came to think that sector span + radial axis range
    // zooming will be better
    //
    // TODO confirm with team.
    // x: {},
    // y: {},
    // zoom: {},

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

    // Maybe this should angularaxis.range correspond to
    // angular span of the drawing area?
    //
    // matlab's angular equivalent to 'range' bounds the drawing area
    // (partial circles as they call it)
    // https://www.mathworks.com/help/matlab/ref/thetalim.html
    //
    // as this attribute would be best set in (absolute) angles,
    // I think this should be set outside of angularaxis e.g
    // as polar.sector: [0, 180]
    sector: {
        valType: 'info_array',
        items: [
            // or be more strict -> `valType: 'angle' with `dflt: [0, 360]`
            {valType: 'number', editType: 'plot'},
            {valType: 'number', editType: 'plot'}
        ],
        dflt: [0, 360],
        role: 'info',
        editType: 'plot',
        description: [
            'Sets angular span of this polar subplot in '
        ].join(' ')
    },

    bgcolor: {
        valType: 'color',
        role: 'style',
        editType: 'style',
        dflt: colorAttrs.background,
        description: 'Set the background color of the subplot'
    },

    radialaxis: extendFlat({
        type: axesAttrs.type,
        autorange: axesAttrs.autorange,
        // might make 'nonnegative' the default
        rangemode: axesAttrs.rangemode,
        range: axesAttrs.range,
        categoryorder: axesAttrs.categoryorder,
        categoryarray: axesAttrs.categoryarray,
        calendar: axesAttrs.calendar,

        // position (analogous to xaxis.position),
        // or maybe something more specific e.g. angle angleoffset?
        //
        // (should this support any data coordinate system?)
        // maybe it most intuitive to set this as just an angle!
        position: {
            valType: 'angle',
            // valType: 'any',
            editType: 'plot',
            role: 'info',
            dflt: 0,
            description: [
                '...',
                'defaults to the first `polar.sector` angle.'
            ].join(' ')
        },

        side: {
            valType: 'enumerated',
            // maybe 'clockwise' and 'counterclockwise' would be best here
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
        // maybe something like 'span' or 'hole' (like pie, but pie set it in data coords)
        // span: {},
        // hole: 1

        // maybe should add a boolean to enable square grid lines
        // and square axis lines
        // (most common in radar-like charts)
        // e.g. squareline/squaregrid or showline/showgrid: 'square' (on-top of true)

        editType: 'calc'
    }, axisStyleAttrs),

    angularaxis: extendFlat({
        type: {
            valType: 'enumerated',
            // 'linear' should probably be called 'angle' or 'angular' here
            // to make clear that axis here is periodic.
            //
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

        period: {
            valType: 'any'

            // defaults to 360 / 2*pi for linear
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
            values: ['radians', 'degrees'],
            dflt: 'degrees',
            role: 'info',
            editType: 'calc+clearAxisTypes',
            description: [
                'Sets the format unit of the formatted *theta* values.',
                'Has an effect only when `angularaxis.type` is *linear*.'
            ].join(' ')
        },

        // we could make the default 'clockwise' for date axes ...
        direction: {
            valType: 'enumerated',
            values: ['counterclockwise', 'clockwise'],
            dflt: 'counterclockwise',
            role: 'info',
            editType: 'plot',
            description: [
                'Sets the direction corresponding to positive angles.'
            ].join(' ')
        },

        // matlab uses thetaZeroLocation: 'North', 'West', 'East', 'South'
        // mpl uses set_theta_zero_location('W', offset=10)
        //
        // position is analogous to yaxis.position, but as an angle (going
        // counterclockwise about cartesian y=0.
        //
        // we could maybe make `position: 90` by default for category and date angular axes.
        position: {
            valType: 'angle',
            dflt: 0,
            editType: 'plot',
            role: 'info',
            description: [
                'Start position (in degree between -180 and 180) of the angular axis',
                'Note that by default, polar subplots are orientation such that the theta=0',
                'corresponds to a line pointing right.',
                'For example to make the angular axis start from the North (like on a compass),'

            ].join(' ')
        },

        editType: 'calc'
    }, axisStyleAttrs),

    // TODO maybe?
    // annotations:
};
