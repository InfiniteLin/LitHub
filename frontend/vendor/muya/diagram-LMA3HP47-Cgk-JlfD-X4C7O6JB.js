import{a as W}from"./chunk-3HOPXJEE.js";import{l as T}from"./chunk-7HTHTWOA.js";import{H as m}from"./chunk-7OMNKLCM.js";import{a as F}from"./chunk-3CNIC7P2.js";import{B as x,O as $,T as v,U as B,V as C,W as P,X as S,Y as z,Z as E,r as y}from"./chunk-4UYRA7EZ.js";import{b as h,d as u}from"./chunk-K4WBIYRJ.js";import"./chunk-BE4IVMIW.js";import"./chunk-DNJCDTWK.js";import"./chunk-AZ4T6ALD.js";var w,Y=y.packet,D=(w=class{constructor(){this.packet=[],this.setAccTitle=B,this.getAccTitle=C,this.setDiagramTitle=z,this.getDiagramTitle=E,this.getAccDescription=S,this.setAccDescription=P}getConfig(){let t=m({...Y,...x().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){v(),this.packet=[]}},h(w,"PacketDB"),w),L=1e4,M=h((t,e)=>{W(t,e);let l=-1,r=[],n=1,{bitsPerRow:c}=e.getConfig();for(let{start:a,end:i,bits:s,label:o}of t.blocks){var b;if(a!==void 0&&i!==void 0&&i<a)throw Error(`Packet block ${a} - ${i} is invalid. End must be greater than start.`);if(a!=null||(a=l+1),a!==l+1){var g;throw Error(`Packet block ${a} - ${(g=i)==null?a:g} is not contiguous. It should start from ${l+1}.`)}if(s===0)throw Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);for(i!=null||(i=a+((b=s)==null?1:b)-1),s!=null||(s=i-a+1),l=i,u.debug(`Packet block ${a} - ${l} with label ${o}`);r.length<=c+1&&e.getPacket().length<L;){let[p,d]=_({start:a,end:i,bits:s,label:o},n,c);if(r.push(p),p.end+1===n*c&&(e.pushWord(r),r=[],n++),!d)break;({start:a,end:i,bits:s,label:o}=d)}}e.pushWord(r)},"populate"),_=h((t,e,l)=>{if(t.start===void 0)throw Error("start should have been set during first phase");if(t.end===void 0)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=e*l)return[t,void 0];let r=e*l-1,n=e*l;return[{start:t.start,end:r,label:t.label,bits:r-t.start},{start:n,end:t.end,label:t.label,bits:t.end-n}]},"getNextFittingBlock"),A={parser:{yy:void 0},parse:h(async t=>{var e;let l=await T("packet",t),r=(e=A.parser)==null?void 0:e.yy;if(!(r instanceof D))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");u.debug(l),M(l,r)},"parse")},j=h((t,e,l,r)=>{let n=r.db,c=n.getConfig(),{rowHeight:b,paddingY:g,bitWidth:a,bitsPerRow:i}=c,s=n.getPacket(),o=n.getDiagramTitle(),p=b+g,d=p*(s.length+1)-(o?0:b),k=a*i+2,f=F(e);f.attr("viewBox",`0 0 ${k} ${d}`),$(f,d,k,c.useMaxWidth);for(let[H,R]of s.entries())I(f,R,H,c);f.append("text").text(o).attr("x",k/2).attr("y",d-p/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),I=h((t,e,l,{rowHeight:r,paddingX:n,paddingY:c,bitWidth:b,bitsPerRow:g,showBits:a})=>{let i=t.append("g"),s=l*(r+c)+c;for(let o of e){let p=o.start%g*b+1,d=(o.end-o.start+1)*b-n;if(i.append("rect").attr("x",p).attr("y",s).attr("width",d).attr("height",r).attr("class","packetBlock"),i.append("text").attr("x",p+d/2).attr("y",s+r/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(o.label),!a)continue;let k=o.end===o.start,f=s-2;i.append("text").attr("x",p+(k?d/2:0)).attr("y",f).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",k?"middle":"start").text(o.start),k||i.append("text").attr("x",p+d).attr("y",f).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(o.end)}},"drawWord"),K={draw:j},N={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},Q={parser:A,get db(){return new D},renderer:K,styles:h(({packet:t}={})=>{let e=m(N,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles")};export{Q as diagram};
