import{a as z}from"./chunk-W7R35OJE.js";import{c as tt}from"./chunk-ZQSVK7JQ.js";import{a as Z}from"./chunk-3HOPXJEE.js";import"./chunk-XOQPIFCR.js";import{l as Y}from"./chunk-7HTHTWOA.js";import{G as J,H as Q}from"./chunk-7OMNKLCM.js";import{a as X}from"./chunk-3CNIC7P2.js";import{O as j,T as I,U as V,V as _,W as H,X as K,Y as U,Z as q,_ as G,r as P}from"./chunk-4UYRA7EZ.js";import{b as o,d as k}from"./chunk-K4WBIYRJ.js";import{E as D,I as B,u as h}from"./chunk-BE4IVMIW.js";import"./chunk-DNJCDTWK.js";import"./chunk-AZ4T6ALD.js";function st(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function ot(t){return t}function ut(){var t=ot,a=st,f=null,s=h(0),p=h(D),w=h(0);function i(e){var n,c=(e=B(e)).length,u,l,x=0,y=Array(c),g=Array(c),S=+s.apply(this,arguments),m=Math.min(D,Math.max(-D,p.apply(this,arguments)-S)),b,C=Math.min(Math.abs(m)/c,w.apply(this,arguments)),$=C*(m<0?-1:1),d;for(n=0;n<c;++n)(d=g[y[n]=n]=+t(e[n],n,e))>0&&(x+=d);for(a==null?f!=null&&y.sort(function(v,T){return f(e[v],e[T])}):y.sort(function(v,T){return a(g[v],g[T])}),n=0,l=x?(m-c*$)/x:0;n<c;++n,S=b)u=y[n],d=g[u],b=S+(d>0?d*l:0)+$,g[u]={data:e[u],index:n,value:d,startAngle:S,endAngle:b,padAngle:C};return g}return i.value=function(e){return arguments.length?(t=typeof e=="function"?e:h(+e),i):t},i.sortValues=function(e){return arguments.length?(a=e,f=null,i):a},i.sort=function(e){return arguments.length?(f=e,a=null,i):f},i.startAngle=function(e){return arguments.length?(s=typeof e=="function"?e:h(+e),i):s},i.endAngle=function(e){return arguments.length?(p=typeof e=="function"?e:h(+e),i):p},i.padAngle=function(e){return arguments.length?(w=typeof e=="function"?e:h(+e),i):w},i}var et=P.pie,R={sections:new Map,showData:!1,config:et},M=R.sections,F=R.showData,pt=structuredClone(et),at={getConfig:o(()=>structuredClone(pt),"getConfig"),clear:o(()=>{M=new Map,F=R.showData,I()},"clear"),setDiagramTitle:U,getDiagramTitle:q,setAccTitle:V,getAccTitle:_,setAccDescription:H,getAccDescription:K,addSection:o(({label:t,value:a})=>{if(a<0)throw Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);M.has(t)||(M.set(t,a),k.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),getSections:o(()=>M,"getSections"),setShowData:o(t=>{F=t},"setShowData"),getShowData:o(()=>F,"getShowData")},ct=o((t,a)=>{Z(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),dt={parse:o(async t=>{let a=await Y("pie",t);k.debug(a),ct(a,at)},"parse")},ft=o(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),gt=o(t=>{let a=[...t.values()].reduce((s,p)=>s+p,0),f=[...t.entries()].map(([s,p])=>({label:s,value:p})).filter(s=>s.value/a*100>=1);return ut().value(s=>s.value).sort(null)(f)},"createPieArcs"),bt={parser:dt,db:at,renderer:{draw:o((t,a,f,s)=>{var p,w;k.debug(`rendering pie chart
`+t);let i=s.db,e=G(),n=Q(i.getConfig(),e.pie),c=X(a),u=c.append("g");u.attr("transform","translate(225,225)");let{themeVariables:l}=e,[x]=J(l.pieOuterStrokeWidth);x!=null||(x=2);let y=n.textPosition,g=z().innerRadius(0).outerRadius(185),S=z().innerRadius(185*y).outerRadius(185*y);u.append("circle").attr("cx",0).attr("cy",0).attr("r",185+x/2).attr("class","pieOuterCircle");let m=i.getSections(),b=gt(m),C=[l.pie1,l.pie2,l.pie3,l.pie4,l.pie5,l.pie6,l.pie7,l.pie8,l.pie9,l.pie10,l.pie11,l.pie12],$=0;m.forEach(r=>{$+=r});let d=b.filter(r=>(r.data.value/$*100).toFixed(0)!=="0"),v=tt(C).domain([...m.keys()]);u.selectAll("mySlices").data(d).enter().append("path").attr("d",g).attr("fill",r=>v(r.data.label)).attr("class","pieCircle"),u.selectAll("mySlices").data(d).enter().append("text").text(r=>(r.data.value/$*100).toFixed(0)+"%").attr("transform",r=>"translate("+S.centroid(r)+")").style("text-anchor","middle").attr("class","slice");let T=u.append("text").text(i.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),N=[...m.entries()].map(([r,A])=>({label:r,value:A})),O=u.selectAll(".legend").data(N).enter().append("g").attr("class","legend").attr("transform",(r,A)=>{let nt=22*N.length/2;return"translate(216,"+(A*22-nt)+")"});O.append("rect").attr("width",18).attr("height",18).style("fill",r=>v(r.label)).style("stroke",r=>v(r.label)),O.append("text").attr("x",22).attr("y",14).text(r=>i.getShowData()?`${r.label} [${r.value}]`:r.label);let rt=512+Math.max(...O.selectAll("text").nodes().map(r=>{var A;return(A=r?.getBoundingClientRect().width)==null?0:A})),E=(p=(w=T.node())==null?void 0:w.getBoundingClientRect().width)==null?0:p,it=450/2-E/2,lt=450/2+E/2,L=Math.min(0,it),W=Math.max(rt,lt)-L;c.attr("viewBox",`${L} 0 ${W} 450`),j(c,450,W,n.useMaxWidth)},"draw")},styles:ft};export{bt as diagram};
