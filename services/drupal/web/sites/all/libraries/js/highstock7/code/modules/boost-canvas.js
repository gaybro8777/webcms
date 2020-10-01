/*
 Highcharts JS v7.2.1 (2019-10-31)

 Boost module

 (c) 2010-2019 Highsoft AS
 Author: Torstein Honsi

 License: www.highcharts.com/license
*/
(function(c){"object"===typeof module&&module.exports?(c["default"]=c,module.exports=c):"function"===typeof define&&define.amd?define("highcharts/modules/boost-canvas",["highcharts"],function(k){c(k);c.Highcharts=k;return c}):c("undefined"!==typeof Highcharts?Highcharts:void 0)})(function(c){function k(d,c,x,k){d.hasOwnProperty(c)||(d[c]=k.apply(null,x))}c=c?c._modules:{};k(c,"modules/boost-canvas.src.js",[c["parts/Globals.js"],c["parts/Utilities.js"]],function(d,c){var k=c.extend,ca=c.isNumber,y=
d.win.document,da=function(){},ea=d.Color,z=d.Series,l=d.seriesTypes,A=d.addEvent,fa=d.fireEvent,ha=d.merge,ia=d.pick,B=d.wrap,L;d.initCanvasBoost=function(){d.seriesTypes.heatmap&&d.wrap(d.seriesTypes.heatmap.prototype,"drawPoints",function(){var a=this.chart,b=this.getContext(),f=this.chart.inverted,t=this.xAxis,e=this.yAxis;b?(this.points.forEach(function(c){var g=c.plotY;void 0===g||isNaN(g)||null===c.y||(g=c.shapeArgs,c=a.styledMode?c.series.colorAttribs(c):c.series.pointAttribs(c),b.fillStyle=
c.fill,f?b.fillRect(e.len-g.y+t.left,t.len-g.x+e.top,-g.height,-g.width):b.fillRect(g.x+t.left,g.y+e.top,g.width,g.height))}),this.canvasToSVG()):this.chart.showLoading("Your browser doesn't support HTML5 canvas, <br>please use a modern browser")});k(z.prototype,{getContext:function(){var a=this.chart,b=a.chartWidth,f=a.chartHeight,c=a.seriesGroup||this.group,e=this,d=function(a,e,f,b,c,d,g){a.call(this,f,e,b,c,d,g)};a.isChartSeriesBoosting()&&(e=a,c=a.seriesGroup);var g=e.ctx;e.canvas||(e.canvas=
y.createElement("canvas"),e.renderTarget=a.renderer.image("",0,0,b,f).addClass("highcharts-boost-canvas").add(c),e.ctx=g=e.canvas.getContext("2d"),a.inverted&&["moveTo","lineTo","rect","arc"].forEach(function(a){B(g,a,d)}),e.boostCopy=function(){e.renderTarget.attr({href:e.canvas.toDataURL("image/png")})},e.boostClear=function(){g.clearRect(0,0,e.canvas.width,e.canvas.height);e===this&&e.renderTarget.attr({href:""})},e.boostClipRect=a.renderer.clipRect(),e.renderTarget.clip(e.boostClipRect));e.canvas.width!==
b&&(e.canvas.width=b);e.canvas.height!==f&&(e.canvas.height=f);e.renderTarget.attr({x:0,y:0,width:b,height:f,style:"pointer-events: none",href:""});e.boostClipRect.attr(a.getBoostClipRect(e));return g},canvasToSVG:function(){this.chart.isChartSeriesBoosting()?this.boostClear&&this.boostClear():(this.boostCopy||this.chart.boostCopy)&&(this.boostCopy||this.chart.boostCopy)()},cvsLineTo:function(a,b,f){a.lineTo(b,f)},renderCanvas:function(){var a=this,b=a.options,f=a.chart,c=this.xAxis,e=this.yAxis,
l=(f.options.boost||{}).timeRendering||!1,g=0,M=a.processedXData,x=a.processedYData,N=b.data,m=c.getExtremes(),C=m.min,D=m.max;m=e.getExtremes();var y=m.min,z=m.max,O={},E,B=!!a.sampling,F=b.marker&&b.marker.radius,P=this.cvsDrawPoint,G=b.lineWidth?this.cvsLineTo:void 0,Q=F&&1>=F?this.cvsMarkerSquare:this.cvsMarkerCircle,ja=this.cvsStrokeBatch||1E3,ka=!1!==b.enableMouseTracking,R;m=b.threshold;var r=e.getThreshold(m),S=ca(m),T=r,la=this.fill,U=a.pointArrayMap&&"low,high"===a.pointArrayMap.join(","),
V=!!b.stacking,W=a.cropStart||0;m=f.options.loading;var ma=a.requireSorting,X,na=b.connectNulls,Y=!M,H,I,u,v,J,q=V?a.data:M||N,oa=a.fillOpacity?(new ea(a.color)).setOpacity(ia(b.fillOpacity,.75)).get():a.color,Z=function(){la?(n.fillStyle=oa,n.fill()):(n.strokeStyle=a.color,n.lineWidth=b.lineWidth,n.stroke())},aa=function(e,c,b,d){0===g&&(n.beginPath(),G&&(n.lineJoin="round"));f.scroller&&"highcharts-navigator-series"===a.options.className?(c+=f.scroller.top,b&&(b+=f.scroller.top)):c+=f.plotTop;e+=
f.plotLeft;X?n.moveTo(e,c):P?P(n,e,c,b,R):G?G(n,e,c):Q&&Q.call(a,n,e,c,F,d);g+=1;g===ja&&(Z(),g=0);R={clientX:e,plotY:c,yBottom:b}},pa="x"===b.findNearestPointBy,ba=this.xData||this.options.xData||this.processedXData||!1,K=function(a,b,d){J=pa?a:a+","+b;ka&&!O[J]&&(O[J]=!0,f.inverted&&(a=c.len-a,b=e.len-b),qa.push({x:ba?ba[W+d]:!1,clientX:a,plotX:a,plotY:b,i:W+d}))};this.renderTarget&&this.renderTarget.attr({href:""});(this.points||this.graph)&&this.destroyGraphics();a.plotGroup("group","series",
a.visible?"visible":"hidden",b.zIndex,f.seriesGroup);a.markerGroup=a.group;A(a,"destroy",function(){a.markerGroup=null});var qa=this.points=[];var n=this.getContext();a.buildKDTree=da;this.boostClear&&this.boostClear();this.visible&&(99999<N.length&&(f.options.loading=ha(m,{labelStyle:{backgroundColor:d.color("#ffffff").setOpacity(.75).get(),padding:"1em",borderRadius:"0.5em"},style:{backgroundColor:"none",opacity:1}}),d.clearTimeout(L),f.showLoading("Drawing..."),f.options.loading=m),l&&console.time("canvas rendering"),
d.eachAsync(q,function(b,d){var g=!1,t=!1,k=!1,l=!1,m="undefined"===typeof f.index,n=!0;if(!m){if(Y){var p=b[0];var h=b[1];q[d+1]&&(k=q[d+1][0]);q[d-1]&&(l=q[d-1][0])}else p=b,h=x[d],q[d+1]&&(k=q[d+1]),q[d-1]&&(l=q[d-1]);k&&k>=C&&k<=D&&(g=!0);l&&l>=C&&l<=D&&(t=!0);if(U){Y&&(h=b.slice(1,3));var w=h[0];h=h[1]}else V&&(p=b.x,h=b.stackY,w=h-b.y);b=null===h;ma||(n=h>=y&&h<=z);if(!b&&(p>=C&&p<=D&&n||g||t))if(p=Math.round(c.toPixels(p,!0)),B){if(void 0===u||p===E){U||(w=h);if(void 0===v||h>I)I=h,v=d;if(void 0===
u||w<H)H=w,u=d}p!==E&&(void 0!==u&&(h=e.toPixels(I,!0),r=e.toPixels(H,!0),aa(p,S?Math.min(h,T):h,S?Math.max(r,T):r,d),K(p,h,v),r!==h&&K(p,r,u)),u=v=void 0,E=p)}else h=Math.round(e.toPixels(h,!0)),aa(p,h,r,d),K(p,h,d);X=b&&!na;0===d%5E4&&(a.boostCopy||a.chart.boostCopy)&&(a.boostCopy||a.chart.boostCopy)()}return!m},function(){var b=f.loadingDiv,e=f.loadingShown;Z();a.canvasToSVG();l&&console.timeEnd("canvas rendering");fa(a,"renderedCanvas");e&&(k(b.style,{transition:"opacity 250ms",opacity:0}),f.loadingShown=
!1,L=setTimeout(function(){b.parentNode&&b.parentNode.removeChild(b);f.loadingDiv=f.loadingSpan=null},250));delete a.buildKDTree;a.buildKDTree()},f.renderer.forExport?Number.MAX_VALUE:void 0))}});l.scatter.prototype.cvsMarkerCircle=function(a,b,c,d){a.moveTo(b,c);a.arc(b,c,d,0,2*Math.PI,!1)};l.scatter.prototype.cvsMarkerSquare=function(a,b,c,d){a.rect(b-d,c-d,2*d,2*d)};l.scatter.prototype.fill=!0;l.bubble&&(l.bubble.prototype.cvsMarkerCircle=function(a,b,c,d,e){a.moveTo(b,c);a.arc(b,c,this.radii&&
this.radii[e],0,2*Math.PI,!1)},l.bubble.prototype.cvsStrokeBatch=1);k(l.area.prototype,{cvsDrawPoint:function(a,b,c,d,e){e&&b!==e.clientX&&(a.moveTo(e.clientX,e.yBottom),a.lineTo(e.clientX,e.plotY),a.lineTo(b,c),a.lineTo(b,d))},fill:!0,fillOpacity:!0,sampling:!0});k(l.column.prototype,{cvsDrawPoint:function(a,b,c,d){a.rect(b-1,c,1,d-c)},fill:!0,sampling:!0});d.Chart.prototype.callbacks.push(function(a){A(a,"predraw",function(){a.renderTarget&&a.renderTarget.attr({href:""});a.canvas&&a.canvas.getContext("2d").clearRect(0,
0,a.canvas.width,a.canvas.height)});A(a,"render",function(){a.boostCopy&&a.boostCopy()})})}});k(c,"masters/modules/boost-canvas.src.js",[],function(){})});
//# sourceMappingURL=boost-canvas.js.map