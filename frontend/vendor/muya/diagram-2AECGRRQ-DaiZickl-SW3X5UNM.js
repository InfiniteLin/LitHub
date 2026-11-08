import{a as D}from"./chunk-CSOGP5KJ.js";import{l as z}from"./chunk-3DYZ6TPN.js";import{H as y}from"./chunk-U2NSQVOM.js";import{a as F}from"./chunk-NGAV2WPY.js";import{B as w,O as L,T,U as A,V as k,W as O,X as S,Y as I,Z as E,p as M,r as C}from"./chunk-OB4QRI3A.js";import{b as o,d as b}from"./chunk-HUKFFAVR.js";import"./chunk-Y3S27BTG.js";import"./chunk-OYIXU42T.js";import"./chunk-PYIMSQMS.js";var m={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},P={axes:[],curves:[],options:m},x=structuredClone(P),j=C.radar,H=o(()=>y({...j,...w().radar}),"getConfig"),R=o(()=>x.axes,"getAxes"),_=o(()=>x.curves,"getCurves"),K=o(()=>x.options,"getOptions"),N=o(e=>{x.axes=e.map(t=>{var a;return{name:t.name,label:(a=t.label)==null?t.name:a}})},"setAxes"),U=o(e=>{x.curves=e.map(t=>{var a;return{name:t.name,label:(a=t.label)==null?t.name:a,entries:Z(t.entries)}})},"setCurves"),Z=o(e=>{if(e[0].axis==null)return e.map(a=>a.value);let t=R();if(t.length===0)throw Error("Axes must be populated before curves for reference entries");return t.map(a=>{let r=e.find(i=>{var l;return((l=i.axis)==null?void 0:l.$refText)===a.name});if(r===void 0)throw Error("Missing entry for axis "+a.label);return r.value})},"computeCurveEntries"),v={getAxes:R,getCurves:_,getOptions:K,setAxes:N,setCurves:U,setOptions:o(e=>{var t,a,r,i,l,s,n,c,d,g;let u=e.reduce((p,h)=>(p[h.name]=h,p),{});x.options={showLegend:(t=(a=u.showLegend)==null?void 0:a.value)==null?m.showLegend:t,ticks:(r=(i=u.ticks)==null?void 0:i.value)==null?m.ticks:r,max:(l=(s=u.max)==null?void 0:s.value)==null?m.max:l,min:(n=(c=u.min)==null?void 0:c.value)==null?m.min:n,graticule:(d=(g=u.graticule)==null?void 0:g.value)==null?m.graticule:d}},"setOptions"),getConfig:H,clear:o(()=>{T(),x=structuredClone(P)},"clear"),setAccTitle:A,getAccTitle:k,setDiagramTitle:I,getDiagramTitle:E,getAccDescription:S,setAccDescription:O},q=o(e=>{D(e,v);let{axes:t,curves:a,options:r}=e;v.setAxes(t),v.setCurves(a),v.setOptions(r)},"populate"),J={parse:o(async e=>{let t=await z("radar",e);b.debug(t),q(t)},"parse")},Q=o((e,t,a,r)=>{var i;let l=r.db,s=l.getAxes(),n=l.getCurves(),c=l.getOptions(),d=l.getConfig(),g=l.getDiagramTitle(),u=X(F(t),d),p=(i=c.max)==null?Math.max(...n.map($=>Math.max(...$.entries))):i,h=c.min,f=Math.min(d.width,d.height)/2;Y(u,s,f,c.ticks,c.graticule),tt(u,s,f,d),B(u,s,n,h,p,c.graticule,d),W(u,n,c.showLegend,d),u.append("text").attr("class","radarTitle").text(g).attr("x",0).attr("y",-d.height/2-d.marginTop)},"draw"),X=o((e,t)=>{var a;let r=t.width+t.marginLeft+t.marginRight,i=t.height+t.marginTop+t.marginBottom,l={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return L(e,i,r,(a=t.useMaxWidth)==null?!0:a),e.attr("viewBox",`0 0 ${r} ${i}`),e.append("g").attr("transform",`translate(${l.x}, ${l.y})`)},"drawFrame"),Y=o((e,t,a,r,i)=>{if(i==="circle")for(let l=0;l<r;l++){let s=a*(l+1)/r;e.append("circle").attr("r",s).attr("class","radarGraticule")}else if(i==="polygon"){let l=t.length;for(let s=0;s<r;s++){let n=a*(s+1)/r,c=t.map((d,g)=>{let u=2*g*Math.PI/l-Math.PI/2;return`${n*Math.cos(u)},${n*Math.sin(u)}`}).join(" ");e.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),tt=o((e,t,a,r)=>{let i=t.length;for(let l=0;l<i;l++){let s=t[l].label,n=2*l*Math.PI/i-Math.PI/2;e.append("line").attr("x1",0).attr("y1",0).attr("x2",a*r.axisScaleFactor*Math.cos(n)).attr("y2",a*r.axisScaleFactor*Math.sin(n)).attr("class","radarAxisLine"),e.append("text").text(s).attr("x",a*r.axisLabelFactor*Math.cos(n)).attr("y",a*r.axisLabelFactor*Math.sin(n)).attr("class","radarAxisLabel")}},"drawAxes");function B(e,t,a,r,i,l,s){let n=t.length,c=Math.min(s.width,s.height)/2;a.forEach((d,g)=>{if(d.entries.length!==n)return;let u=d.entries.map((p,h)=>{let f=2*Math.PI*h/n-Math.PI/2,$=G(p,r,i,c);return{x:$*Math.cos(f),y:$*Math.sin(f)}});l==="circle"?e.append("path").attr("d",V(u,s.curveTension)).attr("class",`radarCurve-${g}`):l==="polygon"&&e.append("polygon").attr("points",u.map(p=>`${p.x},${p.y}`).join(" ")).attr("class",`radarCurve-${g}`)})}o(B,"drawCurves");function G(e,t,a,r){return r*(Math.min(Math.max(e,t),a)-t)/(a-t)}o(G,"relativeRadius");function V(e,t){let a=e.length,r=`M${e[0].x},${e[0].y}`;for(let i=0;i<a;i++){let l=e[(i-1+a)%a],s=e[i],n=e[(i+1)%a],c=e[(i+2)%a],d={x:s.x+(n.x-l.x)*t,y:s.y+(n.y-l.y)*t},g={x:n.x-(c.x-s.x)*t,y:n.y-(c.y-s.y)*t};r+=` C${d.x},${d.y} ${g.x},${g.y} ${n.x},${n.y}`}return`${r} Z`}o(V,"closedRoundCurve");function W(e,t,a,r){if(!a)return;let i=(r.width/2+r.marginRight)*3/4,l=-(r.height/2+r.marginTop)*3/4;t.forEach((s,n)=>{let c=e.append("g").attr("transform",`translate(${i}, ${l+n*20})`);c.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${n}`),c.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(s.label)})}o(W,"drawLegend");var at={draw:Q},et=o((e,t)=>{let a="";for(let r=0;r<e.THEME_COLOR_LIMIT;r++){let i=e[`cScale${r}`];a+=`
		.radarCurve-${r} {
			color: ${i};
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
		}
		`}return a},"genIndexStyles"),rt=o(e=>{let t=y(M(),w().themeVariables);return{themeVariables:t,radarOptions:y(t.radar,e)}},"buildRadarStyleOptions"),dt={parser:J,db:v,renderer:at,styles:o(({radar:e}={})=>{let{themeVariables:t,radarOptions:a}=rt(e);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${a.axisColor};
		stroke-width: ${a.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${a.axisLabelFontSize}px;
		color: ${a.axisColor};
	}
	.radarGraticule {
		fill: ${a.graticuleColor};
		fill-opacity: ${a.graticuleOpacity};
		stroke: ${a.graticuleColor};
		stroke-width: ${a.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${a.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${et(t,a)}
	`},"styles")};export{dt as diagram};
