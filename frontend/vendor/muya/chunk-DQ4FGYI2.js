import{a as Wt}from"./chunk-LZWRFP7V.js";import{a as jt}from"./chunk-33OQTGRR.js";import{A as Ft,I as Pt,ia as Gt}from"./chunk-XUIID4UM.js";import{N as W,T as At,U as Nt,V as Ot,W as wt,X as Rt,Y as Bt,Z as Yt,_ as O}from"./chunk-RWQ23AOI.js";import{b as d,d as k}from"./chunk-G44ZJSED.js";var pt,vt=(function(){var t=d(function(o,l,p,m){for(p=p||{},m=o.length;m--;p[o[m]]=l);return p},"o"),e=[1,2],r=[1,3],s=[1,4],c=[2,4],h=[1,9],f=[1,11],S=[1,16],a=[1,17],y=[1,18],C=[1,19],b=[1,33],v=[1,20],R=[1,21],L=[1,22],B=[1,23],D=[1,24],u=[1,26],E=[1,27],w=[1,28],I=[1,29],Y=[1,30],P=[1,31],G=[1,32],it=[1,35],rt=[1,36],ot=[1,37],nt=[1,38],H=[1,34],g=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],at=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],$t=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],mt={trace:d(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"CLICK",39:"STRING",40:"HREF",41:"classDef",42:"CLASSDEF_ID",43:"CLASSDEF_STYLEOPTS",44:"DEFAULT",45:"style",46:"STYLE_IDS",47:"STYLEDEF_STYLEOPTS",48:"class",49:"CLASSENTITY_IDS",50:"STYLECLASS",51:"direction_tb",52:"direction_bt",53:"direction_rl",54:"direction_lr",56:";",57:"EDGE_STATE",58:"STYLE_SEPARATOR",59:"left_of",60:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:d(function(o,l,p,m,_,i,z){var n=i.length-1;switch(_){case 3:return m.setRootDoc(i[n]),i[n];case 4:this.$=[];break;case 5:i[n]!="nl"&&(i[n-1].push(i[n]),this.$=i[n-1]);break;case 6:case 7:this.$=i[n];break;case 8:this.$="nl";break;case 12:this.$=i[n];break;case 13:let ct=i[n-1];ct.description=m.trimColon(i[n]),this.$=ct;break;case 14:this.$={stmt:"relation",state1:i[n-2],state2:i[n]};break;case 15:let ht=m.trimColon(i[n]);this.$={stmt:"relation",state1:i[n-3],state2:i[n-1],description:ht};break;case 19:this.$={stmt:"state",id:i[n-3],type:"default",description:"",doc:i[n-1]};break;case 20:var M=i[n],X=i[n-2].trim();if(i[n].match(":")){var Q=i[n].split(":");M=Q[0],X=[X,Q[1]]}this.$={stmt:"state",id:M,type:"default",description:X};break;case 21:this.$={stmt:"state",id:i[n-3],type:"default",description:i[n-5],doc:i[n-1]};break;case 22:this.$={stmt:"state",id:i[n],type:"fork"};break;case 23:this.$={stmt:"state",id:i[n],type:"join"};break;case 24:this.$={stmt:"state",id:i[n],type:"choice"};break;case 25:this.$={stmt:"state",id:m.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:i[n-1].trim(),note:{position:i[n-2].trim(),text:i[n].trim()}};break;case 29:this.$=i[n].trim(),m.setAccTitle(this.$);break;case 30:case 31:this.$=i[n].trim(),m.setAccDescription(this.$);break;case 32:this.$={stmt:"click",id:i[n-3],url:i[n-2],tooltip:i[n-1]};break;case 33:this.$={stmt:"click",id:i[n-3],url:i[n-1],tooltip:""};break;case 34:case 35:this.$={stmt:"classDef",id:i[n-1].trim(),classes:i[n].trim()};break;case 36:this.$={stmt:"style",id:i[n-1].trim(),styleClass:i[n].trim()};break;case 37:this.$={stmt:"applyClass",id:i[n-1].trim(),styleClass:i[n].trim()};break;case 38:m.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 39:m.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 40:m.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 41:m.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 44:case 45:this.$={stmt:"state",id:i[n].trim(),type:"default",description:""};break;case 46:this.$={stmt:"state",id:i[n-2].trim(),classes:[i[n].trim()],type:"default",description:""};break;case 47:this.$={stmt:"state",id:i[n-2].trim(),classes:[i[n].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:e,5:r,6:s},{1:[3]},{3:5,4:e,5:r,6:s},{3:6,4:e,5:r,6:s},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],c,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:h,5:f,8:8,9:10,10:12,11:13,12:14,13:15,16:S,17:a,19:y,22:C,24:b,25:v,26:R,27:L,28:B,29:D,32:25,33:u,35:E,37:w,38:I,41:Y,45:P,48:G,51:it,52:rt,53:ot,54:nt,57:H},t(g,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:S,17:a,19:y,22:C,24:b,25:v,26:R,27:L,28:B,29:D,32:25,33:u,35:E,37:w,38:I,41:Y,45:P,48:G,51:it,52:rt,53:ot,54:nt,57:H},t(g,[2,7]),t(g,[2,8]),t(g,[2,9]),t(g,[2,10]),t(g,[2,11]),t(g,[2,12],{14:[1,40],15:[1,41]}),t(g,[2,16]),{18:[1,42]},t(g,[2,18],{20:[1,43]}),{23:[1,44]},t(g,[2,22]),t(g,[2,23]),t(g,[2,24]),t(g,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(g,[2,28]),{34:[1,49]},{36:[1,50]},t(g,[2,31]),{13:51,24:b,57:H},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(at,[2,44],{58:[1,56]}),t(at,[2,45],{58:[1,57]}),t(g,[2,38]),t(g,[2,39]),t(g,[2,40]),t(g,[2,41]),t(g,[2,6]),t(g,[2,13]),{13:58,24:b,57:H},t(g,[2,17]),t($t,c,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(g,[2,29]),t(g,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(g,[2,14],{14:[1,71]}),{4:h,5:f,8:8,9:10,10:12,11:13,12:14,13:15,16:S,17:a,19:y,21:[1,72],22:C,24:b,25:v,26:R,27:L,28:B,29:D,32:25,33:u,35:E,37:w,38:I,41:Y,45:P,48:G,51:it,52:rt,53:ot,54:nt,57:H},t(g,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(g,[2,34]),t(g,[2,35]),t(g,[2,36]),t(g,[2,37]),t(at,[2,46]),t(at,[2,47]),t(g,[2,15]),t(g,[2,19]),t($t,c,{7:78}),t(g,[2,26]),t(g,[2,27]),{5:[1,79]},{5:[1,80]},{4:h,5:f,8:8,9:10,10:12,11:13,12:14,13:15,16:S,17:a,19:y,21:[1,81],22:C,24:b,25:v,26:R,27:L,28:B,29:D,32:25,33:u,35:E,37:w,38:I,41:Y,45:P,48:G,51:it,52:rt,53:ot,54:nt,57:H},t(g,[2,32]),t(g,[2,33]),t(g,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:d(function(o,l){if(l.recoverable)this.trace(o);else{var p=Error(o);throw p.hash=l,p}},"parseError"),parse:d(function(o){var l=this,p=[0],m=[],_=[null],i=[],z=this.table,n="",M=0,X=0,Q=0,ct=2,ht=1,ce=i.slice.call(arguments,1),T=Object.create(this.lexer),U={yy:{}};for(var St in this.yy)Object.prototype.hasOwnProperty.call(this.yy,St)&&(U.yy[St]=this.yy[St]);T.setInput(o,U.yy),U.yy.lexer=T,U.yy.parser=this,T.yylloc===void 0&&(T.yylloc={});var _t=T.yylloc;i.push(_t);var he=T.options&&T.options.ranges;typeof U.yy.parseError=="function"?this.parseError=U.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function de(N){p.length-=2*N,_.length-=N,i.length-=N}d(de,"popStack");function Ct(){var N=m.pop()||T.lex()||ht;return typeof N!="number"&&(N instanceof Array&&(m=N,N=m.pop()),N=l.symbols_[N]||N),N}d(Ct,"lex");for(var $,kt,K,A,bt,V={},dt,F,Lt,ut;;){if(K=p[p.length-1],this.defaultActions[K]?A=this.defaultActions[K]:($==null&&($=Ct()),A=z[K]&&z[K][$]),A===void 0||!A.length||!A[0]){var It="";for(dt in ut=[],z[K])this.terminals_[dt]&&dt>ct&&ut.push("'"+this.terminals_[dt]+"'");It=T.showPosition?"Parse error on line "+(M+1)+`:
`+T.showPosition()+`
Expecting `+ut.join(", ")+", got '"+(this.terminals_[$]||$)+"'":"Parse error on line "+(M+1)+": Unexpected "+($==ht?"end of input":"'"+(this.terminals_[$]||$)+"'"),this.parseError(It,{text:T.match,token:this.terminals_[$]||$,line:T.yylineno,loc:_t,expected:ut})}if(A[0]instanceof Array&&A.length>1)throw Error("Parse Error: multiple actions possible at state: "+K+", token: "+$);switch(A[0]){case 1:p.push($),_.push(T.yytext),i.push(T.yylloc),p.push(A[1]),$=null,kt?($=kt,kt=null):(X=T.yyleng,n=T.yytext,M=T.yylineno,_t=T.yylloc,Q>0&&Q--);break;case 2:if(F=this.productions_[A[1]][1],V.$=_[_.length-F],V._$={first_line:i[i.length-(F||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(F||1)].first_column,last_column:i[i.length-1].last_column},he&&(V._$.range=[i[i.length-(F||1)].range[0],i[i.length-1].range[1]]),bt=this.performAction.apply(V,[n,X,M,U.yy,A[1],_,i].concat(ce)),bt!==void 0)return bt;F&&(p=p.slice(0,-1*F*2),_=_.slice(0,-1*F),i=i.slice(0,-1*F)),p.push(this.productions_[A[1]][0]),_.push(V.$),i.push(V._$),Lt=z[p[p.length-2]][p[p.length-1]],p.push(Lt);break;case 3:return!0}}return!0},"parse")};mt.lexer=(function(){return{EOF:1,parseError:d(function(o,l){if(this.yy.parser)this.yy.parser.parseError(o,l);else throw Error(o)},"parseError"),setInput:d(function(o,l){return this.yy=l||this.yy||{},this._input=o,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:d(function(){var o=this._input[0];return this.yytext+=o,this.yyleng++,this.offset++,this.match+=o,this.matched+=o,o.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),o},"input"),unput:d(function(o){var l=o.length,p=o.split(/(?:\r\n?|\n)/g);this._input=o+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-l),this.offset-=l;var m=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),p.length-1&&(this.yylineno-=p.length-1);var _=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:p?(p.length===m.length?this.yylloc.first_column:0)+m[m.length-p.length].length-p[0].length:this.yylloc.first_column-l},this.options.ranges&&(this.yylloc.range=[_[0],_[0]+this.yyleng-l]),this.yyleng=this.yytext.length,this},"unput"),more:d(function(){return this._more=!0,this},"more"),reject:d(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:d(function(o){this.unput(this.match.slice(o))},"less"),pastInput:d(function(){var o=this.matched.substr(0,this.matched.length-this.match.length);return(o.length>20?"...":"")+o.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:d(function(){var o=this.match;return o.length<20&&(o+=this._input.substr(0,20-o.length)),(o.substr(0,20)+(o.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:d(function(){var o=this.pastInput(),l=Array(o.length+1).join("-");return o+this.upcomingInput()+`
`+l+"^"},"showPosition"),test_match:d(function(o,l){var p,m,_;if(this.options.backtrack_lexer&&(_={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(_.yylloc.range=this.yylloc.range.slice(0))),m=o[0].match(/(?:\r\n?|\n).*/g),m&&(this.yylineno+=m.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:m?m[m.length-1].length-m[m.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+o[0].length},this.yytext+=o[0],this.match+=o[0],this.matches=o,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(o[0].length),this.matched+=o[0],p=this.performAction.call(this,this.yy,this,l,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),p)return p;if(this._backtrack){for(var i in _)this[i]=_[i];return!1}return!1},"test_match"),next:d(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var o,l,p,m;this._more||(this.yytext="",this.match="");for(var _=this._currentRules(),i=0;i<_.length;i++)if(p=this._input.match(this.rules[_[i]]),p&&(!l||p[0].length>l[0].length)){if(l=p,m=i,this.options.backtrack_lexer){if(o=this.test_match(p,_[i]),o!==!1)return o;if(this._backtrack){l=!1;continue}else return!1}else if(!this.options.flex)break}return l?(o=this.test_match(l,_[m]),o===!1?!1:o):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:d(function(){return this.next()||this.lex()},"lex"),begin:d(function(o){this.conditionStack.push(o)},"begin"),popState:d(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:d(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:d(function(o){return o=this.conditionStack.length-1-Math.abs(o||0),o>=0?this.conditionStack[o]:"INITIAL"},"topState"),pushState:d(function(o){this.begin(o)},"pushState"),stateStackSize:d(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:d(function(o,l,p,m){function _(){let i=l.yytext.indexOf("%%");if(i===0)return!1;if(i>0){let z=l.yytext.slice(0,i),n=l.yytext.slice(i);n&&o.lexer.unput(n),l.yytext=z}return!0}switch(d(_,"processId"),p){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:return 51;case 5:return 52;case 6:return 53;case 7:return 54;case 8:return 5;case 9:break;case 10:break;case 11:break;case 12:break;case 13:return this.pushState("SCALE"),17;case 14:return 18;case 15:this.popState();break;case 16:return this.begin("acc_title"),33;case 17:return this.popState(),"acc_title_value";case 18:return this.begin("acc_descr"),35;case 19:return this.popState(),"acc_descr_value";case 20:this.begin("acc_descr_multiline");break;case 21:this.popState();break;case 22:return"acc_descr_multiline_value";case 23:return this.pushState("CLASSDEF"),41;case 24:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 25:return this.popState(),this.pushState("CLASSDEFID"),42;case 26:return this.popState(),43;case 27:return this.pushState("CLASS"),48;case 28:return this.popState(),this.pushState("CLASS_STYLE"),49;case 29:return this.popState(),50;case 30:return this.pushState("STYLE"),45;case 31:return this.popState(),this.pushState("STYLEDEF_STYLES"),46;case 32:return this.popState(),47;case 33:return this.pushState("SCALE"),17;case 34:return 18;case 35:this.popState();break;case 36:this.pushState("STATE");break;case 37:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),25;case 38:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),26;case 39:return this.popState(),l.yytext=l.yytext.slice(0,-10).trim(),27;case 40:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),25;case 41:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),26;case 42:return this.popState(),l.yytext=l.yytext.slice(0,-10).trim(),27;case 43:return 51;case 44:return 52;case 45:return 53;case 46:return 54;case 47:this.pushState("STATE_STRING");break;case 48:return this.pushState("STATE_ID"),"AS";case 49:return _()?(this.popState(),"ID"):void 0;case 50:this.popState();break;case 51:return"STATE_DESCR";case 52:return 19;case 53:this.popState();break;case 54:return this.popState(),this.pushState("struct"),20;case 55:return this.popState(),21;case 56:break;case 57:return this.begin("NOTE"),29;case 58:return this.popState(),this.pushState("NOTE_ID"),59;case 59:return this.popState(),this.pushState("NOTE_ID"),60;case 60:this.popState(),this.pushState("FLOATING_NOTE");break;case 61:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 62:break;case 63:return"NOTE_TEXT";case 64:return _()?(this.popState(),"ID"):void 0;case 65:return _()?(this.popState(),this.pushState("NOTE_TEXT"),24):void 0;case 66:return this.popState(),l.yytext=l.yytext.substr(2).trim(),31;case 67:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 57;case 72:return _()?24:void 0;case 73:return l.yytext=l.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 58;case 77:return 5;case 78:return"INVALID"}},"anonymous"),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,55,56,57,71,72,73,74,75,76],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,54,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}}})();function lt(){this.yy={}}return d(lt,"Parser"),lt.prototype=mt,mt.Parser=lt,new lt})();vt.parser=vt;var Be=vt,ue="TB",Jt="TB",zt="dir",q="state",J="root",Dt="relation",pe="classDef",ye="style",fe="applyClass",et="default",qt="divider",Qt="fill:none",Zt="fill: #333",te="c",ee="markdown",se="normal",Tt="rect",Et="rectWithTitle",ge="stateStart",me="stateEnd",Mt="divider",Ut="roundedWithTitle",Se="note",_e="noteGroup",st="statediagram",ke=`${st}-state`,ie="transition",be="note",Te=`${ie} note-edge`,Ee=`${st}-${be}`,ve=`${st}-cluster`,De=`${st}-cluster-alt`,re="parent",oe="note",xe="state",xt="----",$e=`${xt}${oe}`,Kt=`${xt}${re}`,ne=d((t,e=Jt)=>{if(!t.doc)return e;let r=e;for(let s of t.doc)s.stmt==="dir"&&(r=s.value);return r},"getDir"),Ye={getClasses:d(function(t,e){return e.db.getClasses()},"getClasses"),draw:d(async function(t,e,r,s){var c,h;k.info("REF0:"),k.info("Drawing state diagram (v2)",e);let{securityLevel:f,state:S,layout:a}=O();s.db.extract(s.db.getRootDocV2());let y=s.db.getData(),C=Wt(e,f);y.type=s.type,y.layoutAlgorithm=a,y.nodeSpacing=S?.nodeSpacing||50,y.rankSpacing=S?.rankSpacing||50,O().look==="neo"?y.markers=["barbNeo"]:y.markers=["barb"],y.diagramId=e,await Gt(y,C);try{(typeof s.db.getLinks=="function"?s.db.getLinks():new Map).forEach((b,v)=>{var R;let L=typeof v=="string"?v:typeof v?.id=="string"?v.id:"";if(!L){k.warn("\u26A0\uFE0F Invalid or missing stateId from key:",JSON.stringify(v));return}let B=(R=C.node())==null?void 0:R.querySelectorAll("g"),D;if(B?.forEach(I=>{var Y;((Y=I.textContent)==null?void 0:Y.trim())===L&&(D=I)}),!D){k.warn("\u26A0\uFE0F Could not find node matching text:",L);return}let u=D.parentNode;if(!u){k.warn("\u26A0\uFE0F Node has no parent, cannot wrap:",L);return}let E=document.createElementNS("http://www.w3.org/2000/svg","a"),w=b.url.replace(/^"+|"+$/g,"");if(E.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",w),E.setAttribute("target","_blank"),b.tooltip){let I=b.tooltip.replace(/^"+|"+$/g,"");E.setAttribute("title",I)}u.replaceChild(E,D),E.appendChild(D),k.info("\u{1F517} Wrapped node in <a> tag for:",L,b.url)})}catch(b){k.error("\u274C Error injecting clickable links:",b)}Pt.insertTitle(C,"statediagramTitleText",(c=S?.titleTopMargin)==null?25:c,s.db.getDiagramTitle()),jt(C,8,st,(h=S?.useMaxWidth)==null?!0:h)},"draw"),getDir:ne},ft=new Map,j=0;function gt(t="",e=0,r="",s=xt){return`${xe}-${t}${r!==null&&r.length>0?`${s}${r}`:""}-${e}`}d(gt,"stateDomId");var Ce=d((t,e,r,s,c,h,f,S)=>{k.trace("items",e),e.forEach(a=>{switch(a.stmt){case q:tt(t,a,r,s,c,h,f,S);break;case et:tt(t,a,r,s,c,h,f,S);break;case Dt:{var y;tt(t,a.state1,r,s,c,h,f,S),tt(t,a.state2,r,s,c,h,f,S);let C=f==="neo",b={id:"edge"+j,start:a.state1.id,end:a.state2.id,arrowhead:"normal",arrowTypeEnd:C?"arrow_barb_neo":"arrow_barb",style:Qt,labelStyle:"",label:W.sanitizeText((y=a.description)==null?"":y,O()),arrowheadStyle:Zt,labelpos:te,labelType:ee,thickness:se,classes:ie,look:f};c.push(b),j++}break}})},"setupDoc"),Ht=d((t,e=Jt)=>{let r=e;if(t.doc)for(let s of t.doc)s.stmt==="dir"&&(r=s.value);return r},"getDir");function Z(t,e,r){if(!e.id||e.id==="</join></fork>"||e.id==="</choice>")return;e.cssClasses&&(Array.isArray(e.cssCompiledStyles)||(e.cssCompiledStyles=[]),e.cssClasses.split(" ").forEach(c=>{let h=r.get(c);if(h){var f;e.cssCompiledStyles=[...(f=e.cssCompiledStyles)==null?[]:f,...h.styles]}}));let s=t.find(c=>c.id===e.id);s?Object.assign(s,e):t.push(e)}d(Z,"insertOrUpdateNode");function ae(t){var e,r;return(e=t==null||(r=t.classes)==null?void 0:r.join(" "))==null?"":e}d(ae,"getClassesFromDbInfo");function le(t){var e;return(e=t?.styles)==null?[]:e}d(le,"getStylesFromDbInfo");var tt=d((t,e,r,s,c,h,f,S)=>{let a=e.id,y=r.get(a),C=ae(y),b=le(y),v=O();if(k.info("dataFetcher parsedItem",e,y,b),a!=="root"){var R;let D=Tt;e.start===!0?D=ge:e.start===!1&&(D=me),e.type!==et&&(D=e.type),ft.get(a)||ft.set(a,{id:a,shape:D,description:W.sanitizeText(a,v),cssClasses:`${C} ${ke}`,cssStyles:b});let u=ft.get(a);if(e.description){if(Array.isArray(u.description))u.shape=Et,u.description.push(e.description);else{var L;(L=u.description)!=null&&L.length&&u.description.length>0?(u.shape=Et,u.description===a?u.description=[e.description]:u.description=[u.description,e.description]):(u.shape=Tt,u.description=e.description)}u.description=W.sanitizeTextOrArray(u.description,v)}((R=u.description)==null?void 0:R.length)===1&&u.shape===Et&&(u.type==="group"?u.shape=Ut:u.shape=Tt),!u.type&&e.doc&&(k.info("Setting cluster for XCX",a,Ht(e)),u.type="group",u.isGroup=!0,u.dir=Ht(e),u.shape=e.type===qt?Mt:Ut,u.cssClasses=`${u.cssClasses} ${ve} ${h?De:""}`);let E={labelStyle:"",shape:u.shape,label:u.description,cssClasses:u.cssClasses,cssCompiledStyles:[],cssStyles:u.cssStyles,id:a,dir:u.dir,domId:gt(a,j),type:u.type,isGroup:u.type==="group",padding:8,rx:10,ry:10,look:f,labelType:"markdown"};if(E.shape===Mt&&(E.label=""),t&&t.id!=="root"&&(k.trace("Setting node ",a," to be child of its parent ",t.id),E.parentId=t.id),E.centerLabel=!0,e.note){var B;let w={labelStyle:"",shape:Se,label:e.note.text,labelType:"markdown",cssClasses:Ee,cssStyles:[],cssCompiledStyles:[],id:a+$e+"-"+j,domId:gt(a,j,oe),type:u.type,isGroup:u.type==="group",padding:(B=v.flowchart)==null?void 0:B.padding,look:f,position:e.note.position},I=a+Kt,Y={labelStyle:"",shape:_e,label:e.note.text,cssClasses:u.cssClasses,cssStyles:[],id:a+Kt,domId:gt(a,j,re),type:"group",isGroup:!0,padding:16,look:f,position:e.note.position};j++,Y.id=I,w.parentId=I,Z(s,Y,S),Z(s,w,S),Z(s,E,S);let P=a,G=w.id;e.note.position==="left of"&&(P=w.id,G=a),c.push({id:P+"-"+G,start:P,end:G,arrowhead:"none",arrowTypeEnd:"",style:Qt,labelStyle:"",classes:Te,arrowheadStyle:Zt,labelpos:te,labelType:ee,thickness:se,look:f})}else Z(s,E,S)}e.doc&&(k.trace("Adding nodes children "),Ce(e,e.doc,r,s,c,!h,f,S))},"dataFetcher"),Le=d(()=>{ft.clear(),j=0},"reset"),x={START_NODE:"[*]",START_TYPE:"start",END_NODE:"[*]",END_TYPE:"end",COLOR_KEYWORD:"color",FILL_KEYWORD:"fill",BG_FILL:"bgFill",STYLECLASS_SEP:","},Xt=d(()=>new Map,"newClassesList"),Vt=d(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),yt=d(t=>JSON.parse(JSON.stringify(t)),"clone"),Fe=(pt=class{constructor(t){this.version=t,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=Xt(),this.documents={root:Vt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.getAccTitle=Ot,this.setAccTitle=Nt,this.getAccDescription=Rt,this.setAccDescription=wt,this.setDiagramTitle=Bt,this.getDiagramTitle=Yt,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this)}extract(t){this.clear(!0);for(let s of Array.isArray(t)?t:t.doc)switch(s.stmt){case q:this.addState(s.id.trim(),s.type,s.doc,s.description,s.note);break;case Dt:this.addRelation(s.state1,s.state2,s.description);break;case pe:this.addStyleClass(s.id.trim(),s.classes);break;case ye:this.handleStyleDef(s);break;case fe:this.setCssClass(s.id.trim(),s.styleClass);break;case"click":this.addLink(s.id,s.url,s.tooltip);break}let e=this.getStates(),r=O();Le(),tt(void 0,this.getRootDocV2(),e,this.nodes,this.edges,!0,r.look,this.classes);for(let s of this.nodes)if(Array.isArray(s.label)){if(s.description=s.label.slice(1),s.isGroup&&s.description.length>0)throw Error(`Group nodes can only have label. Remove the additional description for node [${s.id}]`);s.label=s.label[0]}}handleStyleDef(t){let e=t.id.trim().split(","),r=t.styleClass.split(",");for(let s of e){let c=this.getState(s);if(!c){let h=s.trim();this.addState(h),c=this.getState(h)}c&&(c.styles=r.map(h=>{var f;return(f=h.replace(/;/g,""))==null?void 0:f.trim()}))}}setRootDoc(t){k.info("Setting root doc",t),this.rootDoc=t,this.version===1?this.extract(t):this.extract(this.getRootDocV2())}docTranslator(t,e,r){if(e.stmt===Dt){this.docTranslator(t,e.state1,!0),this.docTranslator(t,e.state2,!1);return}if(e.stmt===q&&(e.id===x.START_NODE?(e.id=t.id+(r?"_start":"_end"),e.start=r):e.id=e.id.trim()),e.stmt!==J&&e.stmt!==q||!e.doc)return;let s=[],c=[];for(let h of e.doc)if(h.type===qt){let f=yt(h);f.doc=yt(c),s.push(f),c=[]}else c.push(h);if(s.length>0&&c.length>0){let h={stmt:q,id:Ft(),type:"divider",doc:yt(c)};s.push(yt(h)),e.doc=s}e.doc.forEach(h=>this.docTranslator(e,h,!0))}getRootDocV2(){return this.docTranslator({id:J,stmt:J},{id:J,stmt:J,doc:this.rootDoc},!0),{id:J,doc:this.rootDoc}}addState(t,e=et,r=void 0,s=void 0,c=void 0,h=void 0,f=void 0,S=void 0){let a=t?.trim();if(!this.currentDocument.states.has(a))k.info("Adding state ",a,s),this.currentDocument.states.set(a,{stmt:q,id:a,descriptions:[],type:e,doc:r,note:c,classes:[],styles:[],textStyles:[]});else{let y=this.currentDocument.states.get(a);if(!y)throw Error(`State not found: ${a}`);y.doc||(y.doc=r),y.type||(y.type=e)}if(s&&(k.info("Setting state description",a,s),(Array.isArray(s)?s:[s]).forEach(y=>this.addDescription(a,y.trim()))),c){let y=this.currentDocument.states.get(a);if(!y)throw Error(`State not found: ${a}`);y.note=c,y.note.text=W.sanitizeText(y.note.text,O())}h&&(k.info("Setting state classes",a,h),(Array.isArray(h)?h:[h]).forEach(y=>this.setCssClass(a,y.trim()))),f&&(k.info("Setting state styles",a,f),(Array.isArray(f)?f:[f]).forEach(y=>this.setStyle(a,y.trim()))),S&&(k.info("Setting state styles",a,f),(Array.isArray(S)?S:[S]).forEach(y=>this.setTextStyle(a,y.trim())))}clear(t){this.nodes=[],this.edges=[],this.documents={root:Vt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Xt(),t||(this.links=new Map,At())}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){k.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,e,r){this.links.set(t,{url:e,tooltip:r}),k.warn("Adding link",t,e,r)}getLinks(){return this.links}startIdIfNeeded(t=""){return t===x.START_NODE?(this.startEndCount++,`${x.START_TYPE}${this.startEndCount}`):t}startTypeIfNeeded(t="",e=et){return t===x.START_NODE?x.START_TYPE:e}endIdIfNeeded(t=""){return t===x.END_NODE?(this.startEndCount++,`${x.END_TYPE}${this.startEndCount}`):t}endTypeIfNeeded(t="",e=et){return t===x.END_NODE?x.END_TYPE:e}addRelationObjs(t,e,r=""){let s=this.startIdIfNeeded(t.id.trim()),c=this.startTypeIfNeeded(t.id.trim(),t.type),h=this.startIdIfNeeded(e.id.trim()),f=this.startTypeIfNeeded(e.id.trim(),e.type);this.addState(s,c,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(h,f,e.doc,e.description,e.note,e.classes,e.styles,e.textStyles),this.currentDocument.relations.push({id1:s,id2:h,relationTitle:W.sanitizeText(r,O())})}addRelation(t,e,r){if(typeof t=="object"&&typeof e=="object")this.addRelationObjs(t,e,r);else if(typeof t=="string"&&typeof e=="string"){let s=this.startIdIfNeeded(t.trim()),c=this.startTypeIfNeeded(t),h=this.endIdIfNeeded(e.trim()),f=this.endTypeIfNeeded(e);this.addState(s,c),this.addState(h,f),this.currentDocument.relations.push({id1:s,id2:h,relationTitle:r?W.sanitizeText(r,O()):void 0})}}addDescription(t,e){var r;let s=this.currentDocument.states.get(t),c=e.startsWith(":")?e.replace(":","").trim():e;s==null||(r=s.descriptions)==null||r.push(W.sanitizeText(c,O()))}cleanupLabel(t){return t.startsWith(":")?t.slice(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(t,e=""){this.classes.has(t)||this.classes.set(t,{id:t,styles:[],textStyles:[]});let r=this.classes.get(t);e&&r&&e.split(x.STYLECLASS_SEP).forEach(s=>{let c=s.replace(/([^;]*);/,"$1").trim();if(RegExp(x.COLOR_KEYWORD).exec(s)){let h=c.replace(x.FILL_KEYWORD,x.BG_FILL).replace(x.COLOR_KEYWORD,x.FILL_KEYWORD);r.textStyles.push(h)}r.styles.push(c)})}getClasses(){return this.classes}setCssClass(t,e){t.split(",").forEach(r=>{var s;let c=this.getState(r);if(!c){let h=r.trim();this.addState(h),c=this.getState(h)}c==null||(s=c.classes)==null||s.push(e)})}setStyle(t,e){var r;(r=this.getState(t))==null||(r=r.styles)==null||r.push(e)}setTextStyle(t,e){var r;(r=this.getState(t))==null||(r=r.textStyles)==null||r.push(e)}getDirectionStatement(){return this.rootDoc.find(t=>t.stmt===zt)}getDirection(){var t,e;return(t=(e=this.getDirectionStatement())==null?void 0:e.value)==null?ue:t}setDirection(t){let e=this.getDirectionStatement();e?e.value=t:this.rootDoc.unshift({stmt:zt,value:t})}trimColon(t){return t.startsWith(":")?t.slice(1).trim():t.trim()}getData(){let t=O();return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:ne(this.getRootDocV2())}}getConfig(){return O().state}},d(pt,"StateDB"),pt.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3},pt),Pe=d(t=>{var e;return`
defs [id$="-barbEnd"] {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: ${t.strokeWidth||1};
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${t.edgeLabelBackground};
  p {
    background-color: ${t.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${t.edgeLabelBackground};
    fill: ${t.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: ${t.strokeWidth||1}px;
}
[id$="-barbEnd"] {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

[id$="-dependencyStart"], [id$="-dependencyEnd"] {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}

[data-look="neo"].statediagram-cluster rect {
  fill: ${t.mainBkg};
  stroke: ${t.useGradient?"url("+t.svgId+"-gradient)":t.stateBorder||t.nodeBorder};
  stroke-width: ${(e=t.strokeWidth)==null?1:e};
}
[data-look="neo"].statediagram-cluster rect.outer {
  rx: ${t.radius}px;
  ry: ${t.radius}px;
  filter: ${t.dropShadow?t.dropShadow.replace("url(#drop-shadow)",`url(${t.svgId}-drop-shadow)`):"none"}
}
`},"getStyles");export{Be as a,Ye as b,Fe as c,Pe as d};
