import{A as It,F as Te,a as fe,b as me,d as St,e as Ct,f as Mt,h as Et,j as Yt,l as ye,m as ke,n as pe,o as ge,p as be,q as ve,r as xe,t as At}from"./chunk-K2C7AKPV.js";import{s as he}from"./chunk-ADLBFPGM.js";import"./chunk-Y5BKI32G.js";import"./chunk-XOQPIFCR.js";import{I as ue,ma as $e}from"./chunk-7OMNKLCM.js";import"./chunk-3CNIC7P2.js";import{N as ie,O as ne,T as se,U as re,V as ae,W as oe,X as le,Y as ce,Z as de,_ as rt}from"./chunk-4UYRA7EZ.js";import{a as ee,b as d,d as nt,f as xt}from"./chunk-K4WBIYRJ.js";import{n as te}from"./chunk-BE4IVMIW.js";import{c as yt,e as ct}from"./chunk-DNJCDTWK.js";import"./chunk-AZ4T6ALD.js";function We(t){return t}var $t=1,Ot=2,Ft=3,Tt=4,we=1e-6;function Pe(t){return"translate("+t+",0)"}function ze(t){return"translate(0,"+t+")"}function He(t){return i=>+t(i)}function Ne(t,i){return i=Math.max(0,t.bandwidth()-i*2)/2,t.round()&&(i=Math.round(i)),r=>+t(r)+i}function Be(){return!this.__axis}function Ce(t,i){var r=[],n=null,o=null,u=6,k=6,D=3,A=typeof window<"u"&&window.devicePixelRatio>1?0:.5,S=t===$t||t===Tt?-1:1,x=t===Tt||t===Ot?"x":"y",L=t===$t||t===Ft?Pe:ze;function $(w){var H=n??(i.ticks?i.ticks.apply(i,r):i.domain()),E=o??(i.tickFormat?i.tickFormat.apply(i,r):We),v=Math.max(u,0)+D,C=i.range(),F=+C[0]+A,I=+C[C.length-1]+A,N=(i.bandwidth?Ne:He)(i.copy(),A),B=w.selection?w.selection():w,Y=B.selectAll(".domain").data([null]),p=B.selectAll(".tick").data(H,i).order(),m=p.exit(),h=p.enter().append("g").attr("class","tick"),g=p.select("line"),y=p.select("text");Y=Y.merge(Y.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),p=p.merge(h),g=g.merge(h.append("line").attr("stroke","currentColor").attr(x+"2",S*u)),y=y.merge(h.append("text").attr("fill","currentColor").attr(x,S*v).attr("dy",t===$t?"0em":t===Ft?"0.71em":"0.32em")),w!==B&&(Y=Y.transition(w),p=p.transition(w),g=g.transition(w),y=y.transition(w),m=m.transition(w).attr("opacity",we).attr("transform",function(s){return isFinite(s=N(s))?L(s+A):this.getAttribute("transform")}),h.attr("opacity",we).attr("transform",function(s){var c=this.parentNode.__axis;return L((c&&isFinite(c=c(s))?c:N(s))+A)})),m.remove(),Y.attr("d",t===Tt||t===Ot?k?"M"+S*k+","+F+"H"+A+"V"+I+"H"+S*k:"M"+A+","+F+"V"+I:k?"M"+F+","+S*k+"V"+A+"H"+I+"V"+S*k:"M"+F+","+A+"H"+I),p.attr("opacity",1).attr("transform",function(s){return L(N(s)+A)}),g.attr(x+"2",S*u),y.attr(x,S*v).text(E),B.filter(Be).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",t===Ot?"start":t===Tt?"end":"middle"),B.each(function(){this.__axis=N})}return $.scale=function(w){return arguments.length?(i=w,$):i},$.ticks=function(){return r=Array.from(arguments),$},$.tickArguments=function(w){return arguments.length?(r=w==null?[]:Array.from(w),$):r.slice()},$.tickValues=function(w){return arguments.length?(n=w==null?null:Array.from(w),$):n&&n.slice()},$.tickFormat=function(w){return arguments.length?(o=w,$):o},$.tickSize=function(w){return arguments.length?(u=k=+w,$):u},$.tickSizeInner=function(w){return arguments.length?(u=+w,$):u},$.tickSizeOuter=function(w){return arguments.length?(k=+w,$):k},$.tickPadding=function(w){return arguments.length?(D=+w,$):D},$.offset=function(w){return arguments.length?(A=+w,$):A},$}function je(t){return Ce($t,t)}function Re(t){return Ce(Ft,t)}var Ge=yt(((t,i)=>{(function(r,n){typeof t=="object"&&i!==void 0?i.exports=n():typeof define=="function"&&define.amd?define(n):(r=typeof globalThis<"u"?globalThis:r||self).dayjs_plugin_isoWeek=n()})(t,(function(){var r="day";return function(n,o,u){var k=function(S){return S.add(4-S.isoWeekday(),r)},D=o.prototype;D.isoWeekYear=function(){return k(this).year()},D.isoWeek=function(S){if(!this.$utils().u(S))return this.add(7*(S-this.isoWeek()),r);var x,L,$,w,H=k(this),E=(x=this.isoWeekYear(),L=this.$u,$=(L?u.utc:u)().year(x).startOf("year"),w=4-$.isoWeekday(),$.isoWeekday()>4&&(w+=7),$.add(w,r));return H.diff(E,"week")+1},D.isoWeekday=function(S){return this.$utils().u(S)?this.day()||7:this.day(this.day()%7?S:S-7)};var A=D.startOf;D.startOf=function(S,x){var L=this.$utils(),$=!!L.u(x)||x;return L.p(S)==="isoweek"?$?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):A.bind(this)(S,x)}}}))})),Ve=yt(((t,i)=>{(function(r,n){typeof t=="object"&&i!==void 0?i.exports=n():typeof define=="function"&&define.amd?define(n):(r=typeof globalThis<"u"?globalThis:r||self).dayjs_plugin_customParseFormat=n()})(t,(function(){var r={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},n=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,o=/\d/,u=/\d\d/,k=/\d\d?/,D=/\d*[^-_:/,()\s\d]+/,A={},S=function(v){return(v=+v)+(v>68?1900:2e3)},x=function(v){return function(C){this[v]=+C}},L=[/[+-]\d\d:?(\d\d)?|Z/,function(v){(this.zone||(this.zone={})).offset=(function(C){if(!C||C==="Z")return 0;var F=C.match(/([+-]|\d\d)/g),I=60*F[1]+(+F[2]||0);return I===0?0:F[0]==="+"?-I:I})(v)}],$=function(v){var C=A[v];return C&&(C.indexOf?C:C.s.concat(C.f))},w=function(v,C){var F,I=A.meridiem;if(I){for(var N=1;N<=24;N+=1)if(v.indexOf(I(N,0,C))>-1){F=N>12;break}}else F=v===(C?"pm":"PM");return F},H={A:[D,function(v){this.afternoon=w(v,!1)}],a:[D,function(v){this.afternoon=w(v,!0)}],Q:[o,function(v){this.month=3*(v-1)+1}],S:[o,function(v){this.milliseconds=100*v}],SS:[u,function(v){this.milliseconds=10*v}],SSS:[/\d{3}/,function(v){this.milliseconds=+v}],s:[k,x("seconds")],ss:[k,x("seconds")],m:[k,x("minutes")],mm:[k,x("minutes")],H:[k,x("hours")],h:[k,x("hours")],HH:[k,x("hours")],hh:[k,x("hours")],D:[k,x("day")],DD:[u,x("day")],Do:[D,function(v){var C=A.ordinal,F=v.match(/\d+/);if(this.day=F[0],C)for(var I=1;I<=31;I+=1)C(I).replace(/\[|\]/g,"")===v&&(this.day=I)}],w:[k,x("week")],ww:[u,x("week")],M:[k,x("month")],MM:[u,x("month")],MMM:[D,function(v){var C=$("months"),F=($("monthsShort")||C.map((function(I){return I.slice(0,3)}))).indexOf(v)+1;if(F<1)throw Error();this.month=F%12||F}],MMMM:[D,function(v){var C=$("months").indexOf(v)+1;if(C<1)throw Error();this.month=C%12||C}],Y:[/[+-]?\d+/,x("year")],YY:[u,function(v){this.year=S(v)}],YYYY:[/\d{4}/,x("year")],Z:L,ZZ:L};function E(v){for(var C=v,F=A&&A.formats,I=(v=C.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(g,y,s){var c=s&&s.toUpperCase();return y||F[s]||r[s]||F[c].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(f,l,T){return l||T.slice(1)}))}))).match(n),N=I.length,B=0;B<N;B+=1){var Y=I[B],p=H[Y],m=p&&p[0],h=p&&p[1];I[B]=h?{regex:m,parser:h}:Y.replace(/^\[|\]$/g,"")}return function(g){for(var y={},s=0,c=0;s<N;s+=1){var f=I[s];if(typeof f=="string")c+=f.length;else{var l=f.regex,T=f.parser,a=g.slice(c),O=l.exec(a)[0];T.call(y,O),g=g.replace(O,"")}}return(function(e){var b=e.afternoon;if(b!==void 0){var _=e.hours;b?_<12&&(e.hours+=12):_===12&&(e.hours=0),delete e.afternoon}})(y),y}}return function(v,C,F){F.p.customParseFormat=!0,v&&v.parseTwoDigitYear&&(S=v.parseTwoDigitYear);var I=C.prototype,N=I.parse;I.parse=function(B){var Y=B.date,p=B.utc,m=B.args;this.$u=p;var h=m[1];if(typeof h=="string"){var g=m[2]===!0,y=m[3]===!0,s=g||y,c=m[2];y&&(c=m[2]),A=this.$locale(),!g&&c&&(A=F.Ls[c]),this.$d=(function(a,O,e,b){try{if(["x","X"].indexOf(O)>-1)return new Date((O==="X"?1e3:1)*a);var _=E(O)(a),M=_.year,W=_.month,P=_.day,z=_.hours,j=_.minutes,X=_.seconds,ft=_.milliseconds,ot=_.zone,bt=_.week,mt=new Date,lt=P||(M||W?1:mt.getDate()),G=M||mt.getFullYear(),et=0;M&&!W||(et=W>0?W-1:mt.getMonth());var U,Z=z||0,st=j||0,Q=X||0,it=ft||0;return ot?new Date(Date.UTC(G,et,lt,Z,st,Q,it+60*ot.offset*1e3)):e?new Date(Date.UTC(G,et,lt,Z,st,Q,it)):(U=new Date(G,et,lt,Z,st,Q,it),bt&&(U=b(U).week(bt).toDate()),U)}catch{return new Date("")}})(Y,h,p,F),this.init(),c&&c!==!0&&(this.$L=this.locale(c).$L),s&&Y!=this.format(h)&&(this.$d=new Date("")),A={}}else if(h instanceof Array)for(var f=h.length,l=1;l<=f;l+=1){m[1]=h[l-1];var T=F.apply(this,m);if(T.isValid()){this.$d=T.$d,this.$L=T.$L,this.init();break}l===f&&(this.$d=new Date(""))}else N.call(this,B)}}}))})),Ze=yt(((t,i)=>{(function(r,n){typeof t=="object"&&i!==void 0?i.exports=n():typeof define=="function"&&define.amd?define(n):(r=typeof globalThis<"u"?globalThis:r||self).dayjs_plugin_advancedFormat=n()})(t,(function(){return function(r,n){var o=n.prototype,u=o.format;o.format=function(k){var D=this,A=this.$locale();if(!this.isValid())return u.bind(this)(k);var S=this.$utils(),x=(k||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,(function(L){switch(L){case"Q":return Math.ceil((D.$M+1)/3);case"Do":return A.ordinal(D.$D);case"gggg":return D.weekYear();case"GGGG":return D.isoWeekYear();case"wo":return A.ordinal(D.week(),"W");case"w":case"ww":return S.s(D.week(),L==="w"?1:2,"0");case"W":case"WW":return S.s(D.isoWeek(),L==="W"?1:2,"0");case"k":case"kk":return S.s(String(D.$H===0?24:D.$H),L==="k"?1:2,"0");case"X":return Math.floor(D.$d.getTime()/1e3);case"x":return D.$d.getTime();case"z":return"["+D.offsetName()+"]";case"zzz":return"["+D.offsetName("long")+"]";default:return L}}));return u.bind(this)(x)}}}))})),Ue=yt(((t,i)=>{(function(r,n){typeof t=="object"&&i!==void 0?i.exports=n():typeof define=="function"&&define.amd?define(n):(r=typeof globalThis<"u"?globalThis:r||self).dayjs_plugin_duration=n()})(t,(function(){var r,n,o=1e3,u=6e4,k=36e5,D=864e5,A=/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,S=31536e6,x=2628e6,L=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,$={years:S,months:x,days:D,hours:k,minutes:u,seconds:o,milliseconds:1,weeks:6048e5},w=function(Y){return Y instanceof N},H=function(Y,p,m){return new N(Y,m,p.$l)},E=function(Y){return n.p(Y)+"s"},v=function(Y){return Y<0},C=function(Y){return v(Y)?Math.ceil(Y):Math.floor(Y)},F=function(Y){return Math.abs(Y)},I=function(Y,p){return Y?v(Y)?{negative:!0,format:""+F(Y)+p}:{negative:!1,format:""+Y+p}:{negative:!1,format:""}},N=(function(){function Y(m,h,g){var y=this;if(this.$d={},this.$l=g,m===void 0&&(this.$ms=0,this.parseFromMilliseconds()),h)return H(m*$[E(h)],this);if(typeof m=="number")return this.$ms=m,this.parseFromMilliseconds(),this;if(typeof m=="object")return Object.keys(m).forEach((function(f){y.$d[E(f)]=m[f]})),this.calMilliseconds(),this;if(typeof m=="string"){var s=m.match(L);if(s){var c=s.slice(2).map((function(f){return f==null?0:Number(f)}));return this.$d.years=c[0],this.$d.months=c[1],this.$d.weeks=c[2],this.$d.days=c[3],this.$d.hours=c[4],this.$d.minutes=c[5],this.$d.seconds=c[6],this.calMilliseconds(),this}}return this}var p=Y.prototype;return p.calMilliseconds=function(){var m=this;this.$ms=Object.keys(this.$d).reduce((function(h,g){return h+(m.$d[g]||0)*$[g]}),0)},p.parseFromMilliseconds=function(){var m=this.$ms;this.$d.years=C(m/S),m%=S,this.$d.months=C(m/x),m%=x,this.$d.days=C(m/D),m%=D,this.$d.hours=C(m/k),m%=k,this.$d.minutes=C(m/u),m%=u,this.$d.seconds=C(m/o),m%=o,this.$d.milliseconds=m},p.toISOString=function(){var m=I(this.$d.years,"Y"),h=I(this.$d.months,"M"),g=+this.$d.days||0;this.$d.weeks&&(g+=7*this.$d.weeks);var y=I(g,"D"),s=I(this.$d.hours,"H"),c=I(this.$d.minutes,"M"),f=this.$d.seconds||0;this.$d.milliseconds&&(f+=this.$d.milliseconds/1e3,f=Math.round(1e3*f)/1e3);var l=I(f,"S"),T=m.negative||h.negative||y.negative||s.negative||c.negative||l.negative,a=s.format||c.format||l.format?"T":"",O=(T?"-":"")+"P"+m.format+h.format+y.format+a+s.format+c.format+l.format;return O==="P"||O==="-P"?"P0D":O},p.toJSON=function(){return this.toISOString()},p.format=function(m){var h=m||"YYYY-MM-DDTHH:mm:ss",g={Y:this.$d.years,YY:n.s(this.$d.years,2,"0"),YYYY:n.s(this.$d.years,4,"0"),M:this.$d.months,MM:n.s(this.$d.months,2,"0"),D:this.$d.days,DD:n.s(this.$d.days,2,"0"),H:this.$d.hours,HH:n.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:n.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:n.s(this.$d.seconds,2,"0"),SSS:n.s(this.$d.milliseconds,3,"0")};return h.replace(A,(function(y,s){return s||String(g[y])}))},p.as=function(m){return this.$ms/$[E(m)]},p.get=function(m){var h=this.$ms,g=E(m);return g==="milliseconds"?h%=1e3:h=g==="weeks"?C(h/$[g]):this.$d[g],h||0},p.add=function(m,h,g){var y;return y=h?m*$[E(h)]:w(m)?m.$ms:H(m,this).$ms,H(this.$ms+y*(g?-1:1),this)},p.subtract=function(m,h){return this.add(m,h,!0)},p.locale=function(m){var h=this.clone();return h.$l=m,h},p.clone=function(){return H(this.$ms,this)},p.humanize=function(m){return r().add(this.$ms,"ms").locale(this.$l).fromNow(!m)},p.valueOf=function(){return this.asMilliseconds()},p.milliseconds=function(){return this.get("milliseconds")},p.asMilliseconds=function(){return this.as("milliseconds")},p.seconds=function(){return this.get("seconds")},p.asSeconds=function(){return this.as("seconds")},p.minutes=function(){return this.get("minutes")},p.asMinutes=function(){return this.as("minutes")},p.hours=function(){return this.get("hours")},p.asHours=function(){return this.as("hours")},p.days=function(){return this.get("days")},p.asDays=function(){return this.as("days")},p.weeks=function(){return this.get("weeks")},p.asWeeks=function(){return this.as("weeks")},p.months=function(){return this.get("months")},p.asMonths=function(){return this.as("months")},p.years=function(){return this.get("years")},p.asYears=function(){return this.as("years")},Y})(),B=function(Y,p,m){return Y.add(p.years()*m,"y").add(p.months()*m,"M").add(p.days()*m,"d").add(p.hours()*m,"h").add(p.minutes()*m,"m").add(p.seconds()*m,"s").add(p.milliseconds()*m,"ms")};return function(Y,p,m){r=m,n=m().$utils(),m.duration=function(y,s){return H(y,{$l:m.locale()},s)},m.isDuration=w;var h=p.prototype.add,g=p.prototype.subtract;p.prototype.add=function(y,s){return w(y)?B(this,y,1):h.bind(this)(y,s)},p.prototype.subtract=function(y,s){return w(y)?B(this,y,-1):g.bind(this)(y,s)}}}))})),qe=$e(),V=ct(ee(),1),Xe=ct(Ge(),1),Qe=ct(Ve(),1),Je=ct(Ze(),1),Ke=ct(Ue(),1),Wt=(function(){var t=d(function(s,c,f,l){for(f=f||{},l=s.length;l--;f[s[l]]=c);return f},"o"),i=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],n=[1,27],o=[1,28],u=[1,29],k=[1,30],D=[1,31],A=[1,32],S=[1,33],x=[1,34],L=[1,9],$=[1,10],w=[1,11],H=[1,12],E=[1,13],v=[1,14],C=[1,15],F=[1,16],I=[1,19],N=[1,20],B=[1,21],Y=[1,22],p=[1,23],m=[1,25],h=[1,35],g={trace:d(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:d(function(s,c,f,l,T,a,O){var e=a.length-1;switch(T){case 1:return a[e-1];case 2:this.$=[];break;case 3:a[e-1].push(a[e]),this.$=a[e-1];break;case 4:case 5:this.$=a[e];break;case 6:case 7:this.$=[];break;case 8:l.setWeekday("monday");break;case 9:l.setWeekday("tuesday");break;case 10:l.setWeekday("wednesday");break;case 11:l.setWeekday("thursday");break;case 12:l.setWeekday("friday");break;case 13:l.setWeekday("saturday");break;case 14:l.setWeekday("sunday");break;case 15:l.setWeekend("friday");break;case 16:l.setWeekend("saturday");break;case 17:l.setDateFormat(a[e].substr(11)),this.$=a[e].substr(11);break;case 18:l.enableInclusiveEndDates(),this.$=a[e].substr(18);break;case 19:l.TopAxis(),this.$=a[e].substr(8);break;case 20:l.setAxisFormat(a[e].substr(11)),this.$=a[e].substr(11);break;case 21:l.setTickInterval(a[e].substr(13)),this.$=a[e].substr(13);break;case 22:l.setExcludes(a[e].substr(9)),this.$=a[e].substr(9);break;case 23:l.setIncludes(a[e].substr(9)),this.$=a[e].substr(9);break;case 24:l.setTodayMarker(a[e].substr(12)),this.$=a[e].substr(12);break;case 27:l.setDiagramTitle(a[e].substr(6)),this.$=a[e].substr(6);break;case 28:this.$=a[e].trim(),l.setAccTitle(this.$);break;case 29:case 30:this.$=a[e].trim(),l.setAccDescription(this.$);break;case 31:l.addSection(a[e].substr(8)),this.$=a[e].substr(8);break;case 33:l.addTask(a[e-1],a[e]),this.$="task";break;case 34:this.$=a[e-1],l.setClickEvent(a[e-1],a[e],null);break;case 35:this.$=a[e-2],l.setClickEvent(a[e-2],a[e-1],a[e]);break;case 36:this.$=a[e-2],l.setClickEvent(a[e-2],a[e-1],null),l.setLink(a[e-2],a[e]);break;case 37:this.$=a[e-3],l.setClickEvent(a[e-3],a[e-2],a[e-1]),l.setLink(a[e-3],a[e]);break;case 38:this.$=a[e-2],l.setClickEvent(a[e-2],a[e],null),l.setLink(a[e-2],a[e-1]);break;case 39:this.$=a[e-3],l.setClickEvent(a[e-3],a[e-1],a[e]),l.setLink(a[e-3],a[e-2]);break;case 40:this.$=a[e-1],l.setLink(a[e-1],a[e]);break;case 41:case 47:this.$=a[e-1]+" "+a[e];break;case 42:case 43:case 45:this.$=a[e-2]+" "+a[e-1]+" "+a[e];break;case 44:case 46:this.$=a[e-3]+" "+a[e-2]+" "+a[e-1]+" "+a[e];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(i,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:n,14:o,15:u,16:k,17:D,18:A,19:18,20:S,21:x,22:L,23:$,24:w,25:H,26:E,27:v,28:C,29:F,30:I,31:N,33:B,35:Y,36:p,37:24,38:m,40:h},t(i,[2,7],{1:[2,1]}),t(i,[2,3]),{9:36,11:17,12:r,13:n,14:o,15:u,16:k,17:D,18:A,19:18,20:S,21:x,22:L,23:$,24:w,25:H,26:E,27:v,28:C,29:F,30:I,31:N,33:B,35:Y,36:p,37:24,38:m,40:h},t(i,[2,5]),t(i,[2,6]),t(i,[2,17]),t(i,[2,18]),t(i,[2,19]),t(i,[2,20]),t(i,[2,21]),t(i,[2,22]),t(i,[2,23]),t(i,[2,24]),t(i,[2,25]),t(i,[2,26]),t(i,[2,27]),{32:[1,37]},{34:[1,38]},t(i,[2,30]),t(i,[2,31]),t(i,[2,32]),{39:[1,39]},t(i,[2,8]),t(i,[2,9]),t(i,[2,10]),t(i,[2,11]),t(i,[2,12]),t(i,[2,13]),t(i,[2,14]),t(i,[2,15]),t(i,[2,16]),{41:[1,40],43:[1,41]},t(i,[2,4]),t(i,[2,28]),t(i,[2,29]),t(i,[2,33]),t(i,[2,34],{42:[1,42],43:[1,43]}),t(i,[2,40],{41:[1,44]}),t(i,[2,35],{43:[1,45]}),t(i,[2,36]),t(i,[2,38],{42:[1,46]}),t(i,[2,37]),t(i,[2,39])],defaultActions:{},parseError:d(function(s,c){if(c.recoverable)this.trace(s);else{var f=Error(s);throw f.hash=c,f}},"parseError"),parse:d(function(s){var c=this,f=[0],l=[],T=[null],a=[],O=this.table,e="",b=0,_=0,M=0,W=2,P=1,z=a.slice.call(arguments,1),j=Object.create(this.lexer),X={yy:{}};for(var ft in this.yy)Object.prototype.hasOwnProperty.call(this.yy,ft)&&(X.yy[ft]=this.yy[ft]);j.setInput(s,X.yy),X.yy.lexer=j,X.yy.parser=this,j.yylloc===void 0&&(j.yylloc={});var ot=j.yylloc;a.push(ot);var bt=j.options&&j.options.ranges;typeof X.yy.parseError=="function"?this.parseError=X.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function mt(q){f.length-=2*q,T.length-=q,a.length-=q}d(mt,"popStack");function lt(){var q=l.pop()||j.lex()||P;return typeof q!="number"&&(q instanceof Array&&(l=q,q=l.pop()),q=c.symbols_[q]||q),q}d(lt,"lex");for(var G,et,U,Z,st,Q={},it,K,Jt,vt;;){if(U=f[f.length-1],this.defaultActions[U]?Z=this.defaultActions[U]:(G==null&&(G=lt()),Z=O[U]&&O[U][G]),Z===void 0||!Z.length||!Z[0]){var Kt="";for(it in vt=[],O[U])this.terminals_[it]&&it>W&&vt.push("'"+this.terminals_[it]+"'");Kt=j.showPosition?"Parse error on line "+(b+1)+`:
`+j.showPosition()+`
Expecting `+vt.join(", ")+", got '"+(this.terminals_[G]||G)+"'":"Parse error on line "+(b+1)+": Unexpected "+(G==P?"end of input":"'"+(this.terminals_[G]||G)+"'"),this.parseError(Kt,{text:j.match,token:this.terminals_[G]||G,line:j.yylineno,loc:ot,expected:vt})}if(Z[0]instanceof Array&&Z.length>1)throw Error("Parse Error: multiple actions possible at state: "+U+", token: "+G);switch(Z[0]){case 1:f.push(G),T.push(j.yytext),a.push(j.yylloc),f.push(Z[1]),G=null,et?(G=et,et=null):(_=j.yyleng,e=j.yytext,b=j.yylineno,ot=j.yylloc,M>0&&M--);break;case 2:if(K=this.productions_[Z[1]][1],Q.$=T[T.length-K],Q._$={first_line:a[a.length-(K||1)].first_line,last_line:a[a.length-1].last_line,first_column:a[a.length-(K||1)].first_column,last_column:a[a.length-1].last_column},bt&&(Q._$.range=[a[a.length-(K||1)].range[0],a[a.length-1].range[1]]),st=this.performAction.apply(Q,[e,_,b,X.yy,Z[1],T,a].concat(z)),st!==void 0)return st;K&&(f=f.slice(0,-1*K*2),T=T.slice(0,-1*K),a=a.slice(0,-1*K)),f.push(this.productions_[Z[1]][0]),T.push(Q.$),a.push(Q._$),Jt=O[f[f.length-2]][f[f.length-1]],f.push(Jt);break;case 3:return!0}}return!0},"parse")};g.lexer=(function(){return{EOF:1,parseError:d(function(s,c){if(this.yy.parser)this.yy.parser.parseError(s,c);else throw Error(s)},"parseError"),setInput:d(function(s,c){return this.yy=c||this.yy||{},this._input=s,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:d(function(){var s=this._input[0];return this.yytext+=s,this.yyleng++,this.offset++,this.match+=s,this.matched+=s,s.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),s},"input"),unput:d(function(s){var c=s.length,f=s.split(/(?:\r\n?|\n)/g);this._input=s+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-c),this.offset-=c;var l=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var T=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===l.length?this.yylloc.first_column:0)+l[l.length-f.length].length-f[0].length:this.yylloc.first_column-c},this.options.ranges&&(this.yylloc.range=[T[0],T[0]+this.yyleng-c]),this.yyleng=this.yytext.length,this},"unput"),more:d(function(){return this._more=!0,this},"more"),reject:d(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:d(function(s){this.unput(this.match.slice(s))},"less"),pastInput:d(function(){var s=this.matched.substr(0,this.matched.length-this.match.length);return(s.length>20?"...":"")+s.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:d(function(){var s=this.match;return s.length<20&&(s+=this._input.substr(0,20-s.length)),(s.substr(0,20)+(s.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:d(function(){var s=this.pastInput(),c=Array(s.length+1).join("-");return s+this.upcomingInput()+`
`+c+"^"},"showPosition"),test_match:d(function(s,c){var f,l,T;if(this.options.backtrack_lexer&&(T={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(T.yylloc.range=this.yylloc.range.slice(0))),l=s[0].match(/(?:\r\n?|\n).*/g),l&&(this.yylineno+=l.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:l?l[l.length-1].length-l[l.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+s[0].length},this.yytext+=s[0],this.match+=s[0],this.matches=s,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(s[0].length),this.matched+=s[0],f=this.performAction.call(this,this.yy,this,c,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var a in T)this[a]=T[a];return!1}return!1},"test_match"),next:d(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var s,c,f,l;this._more||(this.yytext="",this.match="");for(var T=this._currentRules(),a=0;a<T.length;a++)if(f=this._input.match(this.rules[T[a]]),f&&(!c||f[0].length>c[0].length)){if(c=f,l=a,this.options.backtrack_lexer){if(s=this.test_match(f,T[a]),s!==!1)return s;if(this._backtrack){c=!1;continue}else return!1}else if(!this.options.flex)break}return c?(s=this.test_match(c,T[l]),s===!1?!1:s):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:d(function(){return this.next()||this.lex()},"lex"),begin:d(function(s){this.conditionStack.push(s)},"begin"),popState:d(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:d(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:d(function(s){return s=this.conditionStack.length-1-Math.abs(s||0),s>=0?this.conditionStack[s]:"INITIAL"},"topState"),pushState:d(function(s){this.begin(s)},"pushState"),stateStackSize:d(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:d(function(s,c,f,l){switch(f){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}}})();function y(){this.yy={}}return d(y,"Parser"),y.prototype=g,g.Parser=y,new y})();Wt.parser=Wt;var ti=Wt;V.default.extend(Xe.default),V.default.extend(Qe.default),V.default.extend(Je.default);var _e={friday:5,saturday:6},J="",Bt="",jt=void 0,Rt="",kt=[],pt=[],Gt=new Map,Vt=[],_t=[],ht="",Zt="",Me=["active","done","crit","milestone","vert"],Ut=[],dt="",gt=!1,qt=!1,Xt="sunday",Dt="saturday",Pt=0,ei=d(function(){Vt=[],_t=[],ht="",Ut=[],Ht=0,Nt=void 0,wt=void 0,R=[],J="",Bt="",Zt="",jt=void 0,Rt="",kt=[],pt=[],gt=!1,qt=!1,Pt=0,Gt=new Map,dt="",se(),Xt="sunday",Dt="saturday"},"clear"),ii=d(function(t){dt=t},"setDiagramId"),ni=d(function(t){Bt=t},"setAxisFormat"),si=d(function(){return Bt},"getAxisFormat"),ri=d(function(t){jt=t},"setTickInterval"),ai=d(function(){return jt},"getTickInterval"),oi=d(function(t){Rt=t},"setTodayMarker"),li=d(function(){return Rt},"getTodayMarker"),ci=d(function(t){J=t},"setDateFormat"),di=d(function(){gt=!0},"enableInclusiveEndDates"),ui=d(function(){return gt},"endDatesAreInclusive"),hi=d(function(){qt=!0},"enableTopAxis"),fi=d(function(){return qt},"topAxisEnabled"),mi=d(function(t){Zt=t},"setDisplayMode"),yi=d(function(){return Zt},"getDisplayMode"),ki=d(function(){return J},"getDateFormat"),pi=d(function(t){kt=t.toLowerCase().split(/[\s,]+/)},"setIncludes"),gi=d(function(){return kt},"getIncludes"),bi=d(function(t){pt=t.toLowerCase().split(/[\s,]+/)},"setExcludes"),vi=d(function(){return pt},"getExcludes"),xi=d(function(){return Gt},"getLinks"),Ti=d(function(t){ht=t,Vt.push(t)},"addSection"),$i=d(function(){return Vt},"getSections"),wi=d(function(){let t=De(),i=0;for(;!t&&i<10;)t=De(),i++;return _t=R,_t},"getTasks"),Ee=d(function(t,i,r,n){let o=t.format(i.trim()),u=t.format("YYYY-MM-DD");return n.includes(o)||n.includes(u)?!1:r.includes("weekends")&&(t.isoWeekday()===_e[Dt]||t.isoWeekday()===_e[Dt]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(o)||r.includes(u)},"isInvalidDate"),_i=d(function(t){Xt=t},"setWeekday"),Di=d(function(){return Xt},"getWeekday"),Si=d(function(t){Dt=t},"setWeekend"),Ye=d(function(t,i,r,n){if(!r.length||t.manualEndTime)return;let o;o=t.startTime instanceof Date?(0,V.default)(t.startTime):(0,V.default)(t.startTime,i,!0),o=o.add(1,"d");let u;u=t.endTime instanceof Date?(0,V.default)(t.endTime):(0,V.default)(t.endTime,i,!0);let[k,D]=Ci(o,u,i,r,n);t.endTime=k.toDate(),t.renderEndTime=D},"checkTaskDates"),Ci=d(function(t,i,r,n,o){let u=!1,k=null,D=i.add(1e4,"d");for(;t<=i;){if(u||(k=i.toDate()),u=Ee(t,r,n,o),u&&(i=i.add(1,"d"),i>D))throw Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[i,k]},"fixTaskDates"),zt=d(function(t,i,r){if(r=r.trim(),d(u=>{let k=u.trim();return k==="x"||k==="X"},"isTimestampFormat")(i)&&/^\d+$/.test(r))return new Date(Number(r));let n=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(n!==null){let u=null;for(let D of n.groups.ids.split(" ")){let A=at(D);A!==void 0&&(!u||A.endTime>u.endTime)&&(u=A)}if(u)return u.endTime;let k=new Date;return k.setHours(0,0,0,0),k}let o=(0,V.default)(r,i.trim(),!0);if(o.isValid())return o.toDate();{nt.debug("Invalid date:"+r),nt.debug("With date format:"+i.trim());let u=new Date(r);if(u===void 0||isNaN(u.getTime())||u.getFullYear()<-1e4||u.getFullYear()>1e4)throw Error("Invalid date:"+r);return u}},"getStartDate"),Ae=d(function(t){let i=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return i===null?[NaN,"ms"]:[Number.parseFloat(i[1]),i[2]]},"parseDuration"),Ie=d(function(t,i,r,n=!1){r=r.trim();let o=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(o!==null){let S=null;for(let L of o.groups.ids.split(" ")){let $=at(L);$!==void 0&&(!S||$.startTime<S.startTime)&&(S=$)}if(S)return S.startTime;let x=new Date;return x.setHours(0,0,0,0),x}let u=(0,V.default)(r,i.trim(),!0);if(u.isValid())return n&&(u=u.add(1,"d")),u.toDate();let k=(0,V.default)(t),[D,A]=Ae(r);if(!Number.isNaN(D)){let S=k.add(D,A);S.isValid()&&(k=S)}return k.toDate()},"getEndDate"),Ht=0,ut=d(function(t){return t===void 0?(Ht+=1,"task"+Ht):t},"parseId"),Mi=d(function(t,i){let r;r=i.substr(0,1)===":"?i.substr(1,i.length):i;let n=r.split(","),o={};Qt(n,o,Me);for(let k=0;k<n.length;k++)n[k]=n[k].trim();let u="";switch(n.length){case 1:o.id=ut(),o.startTime=t.endTime,u=n[0];break;case 2:o.id=ut(),o.startTime=zt(void 0,J,n[0]),u=n[1];break;case 3:o.id=ut(n[0]),o.startTime=zt(void 0,J,n[1]),u=n[2];break;default:}return u&&(o.endTime=Ie(o.startTime,J,u,gt),o.manualEndTime=(0,V.default)(u,"YYYY-MM-DD",!0).isValid(),Ye(o,J,pt,kt)),o},"compileData"),Ei=d(function(t,i){let r;r=i.substr(0,1)===":"?i.substr(1,i.length):i;let n=r.split(","),o={};Qt(n,o,Me);for(let u=0;u<n.length;u++)n[u]=n[u].trim();switch(n.length){case 1:o.id=ut(),o.startTime={type:"prevTaskEnd",id:t},o.endTime={data:n[0]};break;case 2:o.id=ut(),o.startTime={type:"getStartDate",startData:n[0]},o.endTime={data:n[1]};break;case 3:o.id=ut(n[0]),o.startTime={type:"getStartDate",startData:n[1]},o.endTime={data:n[2]};break;default:}return o},"parseData"),Nt,wt,R=[],Oe={},Yi=d(function(t,i){let r={section:ht,type:ht,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:i},task:t,classes:[]},n=Ei(wt,i);r.raw.startTime=n.startTime,r.raw.endTime=n.endTime,r.id=n.id,r.prevTaskId=wt,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,r.order=Pt,Pt++;let o=R.push(r);wt=r.id,Oe[r.id]=o-1},"addTask"),at=d(function(t){let i=Oe[t];return R[i]},"findTaskById"),Ai=d(function(t,i){let r={section:ht,type:ht,description:t,task:t,classes:[]},n=Mi(Nt,i);r.startTime=n.startTime,r.endTime=n.endTime,r.id=n.id,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,Nt=r,_t.push(r)},"addTaskOrg"),De=d(function(){let t=d(function(r){let n=R[r],o="";switch(R[r].raw.startTime.type){case"prevTaskEnd":n.startTime=at(n.prevTaskId).endTime;break;case"getStartDate":o=zt(void 0,J,R[r].raw.startTime.startData),o&&(R[r].startTime=o);break}return R[r].startTime&&(R[r].endTime=Ie(R[r].startTime,J,R[r].raw.endTime.data,gt),R[r].endTime&&(R[r].processed=!0,R[r].manualEndTime=(0,V.default)(R[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Ye(R[r],J,pt,kt))),R[r].processed},"compileTask"),i=!0;for(let[r,n]of R.entries())t(r),i=i&&n.processed;return i},"compileTasks"),Ii=d(function(t,i){let r=i;rt().securityLevel!=="loose"&&(r=(0,qe.sanitizeUrl)(i)),t.split(",").forEach(function(n){at(n)!==void 0&&(Fe(n,()=>{window.open(r,"_self")}),Gt.set(n,r))}),Le(t,"clickable")},"setLink"),Le=d(function(t,i){t.split(",").forEach(function(r){let n=at(r);n!==void 0&&n.classes.push(i)})},"setClass"),Oi=d(function(t,i,r){if(rt().securityLevel!=="loose"||i===void 0)return;let n=[];if(typeof r=="string"){n=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let o=0;o<n.length;o++){let u=n[o].trim();u.startsWith('"')&&u.endsWith('"')&&(u=u.substr(1,u.length-2)),n[o]=u}}n.length===0&&n.push(t),at(t)!==void 0&&Fe(t,()=>{ue.runFunc(i,...n)})},"setClickFun"),Fe=d(function(t,i){Ut.push(function(){let r=dt?`${dt}-${t}`:t,n=document.querySelector(`[id="${r}"]`);n!==null&&n.addEventListener("click",function(){i()})},function(){let r=dt?`${dt}-${t}`:t,n=document.querySelector(`[id="${r}-text"]`);n!==null&&n.addEventListener("click",function(){i()})})},"pushFun"),Li={getConfig:d(()=>rt().gantt,"getConfig"),clear:ei,setDateFormat:ci,getDateFormat:ki,enableInclusiveEndDates:di,endDatesAreInclusive:ui,enableTopAxis:hi,topAxisEnabled:fi,setAxisFormat:ni,getAxisFormat:si,setTickInterval:ri,getTickInterval:ai,setTodayMarker:oi,getTodayMarker:li,setAccTitle:re,getAccTitle:ae,setDiagramTitle:ce,getDiagramTitle:de,setDiagramId:ii,setDisplayMode:mi,getDisplayMode:yi,setAccDescription:oe,getAccDescription:le,addSection:Ti,getSections:$i,getTasks:wi,addTask:Yi,findTaskById:at,addTaskOrg:Ai,setIncludes:pi,getIncludes:gi,setExcludes:bi,getExcludes:vi,setClickEvent:d(function(t,i,r){t.split(",").forEach(function(n){Oi(n,i,r)}),Le(t,"clickable")},"setClickEvent"),setLink:Ii,getLinks:xi,bindFunctions:d(function(t){Ut.forEach(function(i){i(t)})},"bindFunctions"),parseDuration:Ae,isInvalidDate:Ee,setWeekday:_i,getWeekday:Di,setWeekend:Si};function Qt(t,i,r){let n=!0;for(;n;)n=!1,r.forEach(function(o){let u="^\\s*"+o+"\\s*$",k=new RegExp(u);t[0].match(k)&&(i[o]=!0,t.shift(1),n=!0)})}d(Qt,"getTaskTags"),V.default.extend(Ke.default);var Fi=d(function(){nt.debug("Something is calling, setConf, remove the call")},"setConf"),Se={monday:ke,tuesday:pe,wednesday:ge,thursday:be,friday:ve,saturday:xe,sunday:ye},Wi=d((t,i)=>{let r=[...t].map(()=>-1/0),n=[...t].sort((u,k)=>u.startTime-k.startTime||u.order-k.order),o=0;for(let u of n)for(let k=0;k<r.length;k++)if(u.startTime>=r[k]){r[k]=u.endTime,u.order=k+i,k>o&&(o=k);break}return o},"getMaxIntersections"),tt,Lt=1e4,Vi={parser:ti,db:Li,renderer:{setConf:Fi,draw:d(function(t,i,r,n){let o=rt().gantt;n.db.setDiagramId(i);let u=rt().securityLevel,k;u==="sandbox"&&(k=xt("#i"+i));let D=xt(u==="sandbox"?k.nodes()[0].contentDocument.body:"body"),A=u==="sandbox"?k.nodes()[0].contentDocument:document,S=A.getElementById(i);tt=S.parentElement.offsetWidth,tt===void 0&&(tt=1200),o.useWidth!==void 0&&(tt=o.useWidth);let x=n.db.getTasks(),L=[];for(let h of x)L.push(h.type);L=m(L);let $={},w=2*o.topPadding;if(n.db.getDisplayMode()==="compact"||o.displayMode==="compact"){let h={};for(let y of x)h[y.section]===void 0?h[y.section]=[y]:h[y.section].push(y);let g=0;for(let y of Object.keys(h)){let s=Wi(h[y],g)+1;g+=s,w+=s*(o.barHeight+o.barGap),$[y]=s}}else{w+=x.length*(o.barHeight+o.barGap);for(let h of L)$[h]=x.filter(g=>g.type===h).length}S.setAttribute("viewBox","0 0 "+tt+" "+w);let H=D.select(`[id="${i}"]`),E=Te().domain([me(x,function(h){return h.startTime}),fe(x,function(h){return h.endTime})]).rangeRound([0,tt-o.leftPadding-o.rightPadding]);function v(h,g){let y=h.startTime,s=g.startTime,c=0;return y>s?c=1:y<s&&(c=-1),c}d(v,"taskCompare"),x.sort(v),C(x,tt,w),ne(H,w,tt,o.useMaxWidth),H.append("text").text(n.db.getDiagramTitle()).attr("x",tt/2).attr("y",o.titleTopMargin).attr("class","titleText");function C(h,g,y){let s=o.barHeight,c=s+o.barGap,f=o.topPadding,l=o.leftPadding,T=he().domain([0,L.length]).range(["#00B9FA","#F95002"]).interpolate(te);I(c,f,l,g,y,h,n.db.getExcludes(),n.db.getIncludes()),B(l,f,g,y),F(h,c,f,l,s,T,g,y),Y(c,f,l,s,T),p(l,f,g,y)}d(C,"makeGantt");function F(h,g,y,s,c,f,l){h.sort((e,b)=>e.vert===b.vert?0:e.vert?1:-1);let T=[...new Set(h.map(e=>e.order))].map(e=>h.find(b=>b.order===e));H.append("g").selectAll("rect").data(T).enter().append("rect").attr("x",0).attr("y",function(e,b){return b=e.order,b*g+y-2}).attr("width",function(){return l-o.rightPadding/2}).attr("height",g).attr("class",function(e){for(let[b,_]of L.entries())if(e.type===_)return"section section"+b%o.numberSectionStyles;return"section section0"}).enter();let a=H.append("g").selectAll("rect").data(h).enter(),O=n.db.getLinks();if(a.append("rect").attr("id",function(e){return i+"-"+e.id}).attr("rx",3).attr("ry",3).attr("x",function(e){return e.milestone?E(e.startTime)+s+.5*(E(e.endTime)-E(e.startTime))-.5*c:E(e.startTime)+s}).attr("y",function(e,b){return b=e.order,e.vert?o.gridLineStartPadding:b*g+y}).attr("width",function(e){return e.milestone?c:e.vert?.08*c:E(e.renderEndTime||e.endTime)-E(e.startTime)}).attr("height",function(e){return e.vert?x.length*(o.barHeight+o.barGap)+o.barHeight*2:c}).attr("transform-origin",function(e,b){return b=e.order,(E(e.startTime)+s+.5*(E(e.endTime)-E(e.startTime))).toString()+"px "+(b*g+y+.5*c).toString()+"px"}).attr("class",function(e){let b="";e.classes.length>0&&(b=e.classes.join(" "));let _=0;for(let[W,P]of L.entries())e.type===P&&(_=W%o.numberSectionStyles);let M="";return e.active?e.crit?M+=" activeCrit":M=" active":e.done?M=e.crit?" doneCrit":" done":e.crit&&(M+=" crit"),M.length===0&&(M=" task"),e.milestone&&(M=" milestone "+M),e.vert&&(M=" vert "+M),M+=_,M+=" "+b,"task"+M}),a.append("text").attr("id",function(e){return i+"-"+e.id+"-text"}).text(function(e){return e.task}).attr("font-size",o.fontSize).attr("x",function(e){let b=E(e.startTime),_=E(e.renderEndTime||e.endTime);if(e.milestone&&(b+=.5*(E(e.endTime)-E(e.startTime))-.5*c,_=b+c),e.vert)return E(e.startTime)+s;let M=this.getBBox().width;return M>_-b?_+M+1.5*o.leftPadding>l?b+s-5:_+s+5:(_-b)/2+b+s}).attr("y",function(e,b){return e.vert?o.gridLineStartPadding+x.length*(o.barHeight+o.barGap)+60:(b=e.order,b*g+o.barHeight/2+(o.fontSize/2-2)+y)}).attr("text-height",c).attr("class",function(e){let b=E(e.startTime),_=E(e.endTime);e.milestone&&(_=b+c);let M=this.getBBox().width,W="";e.classes.length>0&&(W=e.classes.join(" "));let P=0;for(let[j,X]of L.entries())e.type===X&&(P=j%o.numberSectionStyles);let z="";return e.active&&(z=e.crit?"activeCritText"+P:"activeText"+P),e.done?z=e.crit?z+" doneCritText"+P:z+" doneText"+P:e.crit&&(z=z+" critText"+P),e.milestone&&(z+=" milestoneText"),e.vert&&(z+=" vertText"),M>_-b?_+M+1.5*o.leftPadding>l?W+" taskTextOutsideLeft taskTextOutside"+P+" "+z:W+" taskTextOutsideRight taskTextOutside"+P+" "+z+" width-"+M:W+" taskText taskText"+P+" "+z+" width-"+M}),rt().securityLevel==="sandbox"){let e;e=xt("#i"+i);let b=e.nodes()[0].contentDocument;a.filter(function(_){return O.has(_.id)}).each(function(_){var M=b.querySelector("#"+CSS.escape(i+"-"+_.id)),W=b.querySelector("#"+CSS.escape(i+"-"+_.id+"-text"));let P=M.parentNode;var z=b.createElement("a");z.setAttribute("xlink:href",O.get(_.id)),z.setAttribute("target","_top"),P.appendChild(z),z.appendChild(M),z.appendChild(W)})}}d(F,"drawRects");function I(h,g,y,s,c,f,l,T){if(l.length===0&&T.length===0)return;let a,O;for(let{startTime:W,endTime:P}of f)(a===void 0||W<a)&&(a=W),(O===void 0||P>O)&&(O=P);if(!a||!O)return;if((0,V.default)(O).diff((0,V.default)(a),"year")>5){nt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}let e=n.db.getDateFormat(),b=[],_=null,M=(0,V.default)(a);for(;M.valueOf()<=O;)n.db.isInvalidDate(M,e,l,T)?_?_.end=M:_={start:M,end:M}:_&&(b.push(_),_=null),M=M.add(1,"d");H.append("g").selectAll("rect").data(b).enter().append("rect").attr("id",W=>i+"-exclude-"+W.start.format("YYYY-MM-DD")).attr("x",W=>E(W.start.startOf("day"))+y).attr("y",o.gridLineStartPadding).attr("width",W=>E(W.end.endOf("day"))-E(W.start.startOf("day"))).attr("height",c-g-o.gridLineStartPadding).attr("transform-origin",function(W,P){return(E(W.start)+y+.5*(E(W.end)-E(W.start))).toString()+"px "+(P*h+.5*c).toString()+"px"}).attr("class","exclude-range")}d(I,"drawExcludeDays");function N(h,g,y,s){if(y<=0||h>g)return 1/0;let c=g-h,f=V.default.duration({[s??"day"]:y}).asMilliseconds();return f<=0?1/0:Math.ceil(c/f)}d(N,"getEstimatedTickCount");function B(h,g,y,s){let c=n.db.getDateFormat(),f=n.db.getAxisFormat(),l;if(f)l=f;else if(c==="D")l="%d";else{var T;l=(T=o.axisFormat)==null?"%Y-%m-%d":T}let a=Re(E).tickSize(-s+g+o.gridLineStartPadding).tickFormat(It(l)),O=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(n.db.getTickInterval()||o.tickInterval);if(O!==null){let e=parseInt(O[1],10);if(isNaN(e)||e<=0)nt.warn(`Invalid tick interval value: "${O[1]}". Skipping custom tick interval.`);else{let b=O[2],_=n.db.getWeekday()||o.weekday,M=E.domain(),W=M[0],P=M[1],z=N(W,P,e,b);if(z>Lt)nt.warn(`The tick interval "${e}${b}" would generate ${z} ticks, which exceeds the maximum allowed (${Lt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(b){case"millisecond":a.ticks(St.every(e));break;case"second":a.ticks(Ct.every(e));break;case"minute":a.ticks(Mt.every(e));break;case"hour":a.ticks(Et.every(e));break;case"day":a.ticks(Yt.every(e));break;case"week":a.ticks(Se[_].every(e));break;case"month":a.ticks(At.every(e));break}}}if(H.append("g").attr("class","grid").attr("transform","translate("+h+", "+(s-50)+")").call(a).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),n.db.topAxisEnabled()||o.topAxis){let e=je(E).tickSize(-s+g+o.gridLineStartPadding).tickFormat(It(l));if(O!==null){let b=parseInt(O[1],10);if(isNaN(b)||b<=0)nt.warn(`Invalid tick interval value: "${O[1]}". Skipping custom tick interval.`);else{let _=O[2],M=n.db.getWeekday()||o.weekday,W=E.domain(),P=W[0],z=W[1];if(N(P,z,b,_)<=Lt)switch(_){case"millisecond":e.ticks(St.every(b));break;case"second":e.ticks(Ct.every(b));break;case"minute":e.ticks(Mt.every(b));break;case"hour":e.ticks(Et.every(b));break;case"day":e.ticks(Yt.every(b));break;case"week":e.ticks(Se[M].every(b));break;case"month":e.ticks(At.every(b));break}}}H.append("g").attr("class","grid").attr("transform","translate("+h+", "+g+")").call(e).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}d(B,"makeGrid");function Y(h,g){let y=0,s=Object.keys($).map(c=>[c,$[c]]);H.append("g").selectAll("text").data(s).enter().append(function(c){let f=c[0].split(ie.lineBreakRegex),l=-(f.length-1)/2,T=A.createElementNS("http://www.w3.org/2000/svg","text");T.setAttribute("dy",l+"em");for(let[a,O]of f.entries()){let e=A.createElementNS("http://www.w3.org/2000/svg","tspan");e.setAttribute("alignment-baseline","central"),e.setAttribute("x","10"),a>0&&e.setAttribute("dy","1em"),e.textContent=O,T.appendChild(e)}return T}).attr("x",10).attr("y",function(c,f){if(f>0)for(let l=0;l<f;l++)return y+=s[f-1][1],c[1]*h/2+y*h+g;else return c[1]*h/2+g}).attr("font-size",o.sectionFontSize).attr("class",function(c){for(let[f,l]of L.entries())if(c[0]===l)return"sectionTitle sectionTitle"+f%o.numberSectionStyles;return"sectionTitle"})}d(Y,"vertLabels");function p(h,g,y,s){let c=n.db.getTodayMarker();if(c==="off")return;let f=H.append("g").attr("class","today"),l=new Date,T=f.append("line");T.attr("x1",E(l)+h).attr("x2",E(l)+h).attr("y1",o.titleTopMargin).attr("y2",s-o.titleTopMargin).attr("class","today"),c!==""&&T.attr("style",c.replace(/,/g,";"))}d(p,"drawToday");function m(h){let g={},y=[];for(let s=0,c=h.length;s<c;++s)Object.prototype.hasOwnProperty.call(g,h[s])||(g[h[s]]=!0,y.push(h[s]));return y}d(m,"checkUnique")},"draw")},styles:d(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar \u2014 same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles")};export{Vi as diagram};
