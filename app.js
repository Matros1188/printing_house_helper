
const CATALOG=[{"key": "cost", "title": "Стоимость заказа", "desc": "Себестоимость, выручка и прибыль", "cat": "Производство"}, {"key": "paper", "title": "Стоимость бумаги", "desc": "Стоимость бумажного тиража", "cat": "Материалы"}, {"key": "layout", "title": "Раскладка на листе", "desc": "Сколько изделий помещается на листе", "cat": "Производство"}, {"key": "waste", "title": "Отходы", "desc": "Расчёт технологического запаса", "cat": "Производство"}, {"key": "margin", "title": "Маржа", "desc": "Маржа и прибыль заказа", "cat": "Финансы"}, {"key": "weight", "title": "Вес тиража", "desc": "Оценка массы тиража", "cat": "Логистика"}, {"key": "time", "title": "Время производства", "desc": "Расчёт времени изготовления", "cat": "Производство"}, {"key": "ink", "title": "Расход краски", "desc": "Оценка стоимости краски", "cat": "Материалы"}, {"key": "business-cards", "title": "Визитки", "desc": "Расчёт прибыли с тиража визиток", "cat": "Полиграфия"}, {"key": "labels", "title": "Рулонные этикетки", "desc": "Расчёт площади материала", "cat": "Полиграфия"}, {"key": "lamination", "title": "Ламинация", "desc": "Стоимость ламинации", "cat": "Отделка"}, {"key": "folding", "title": "Фальцовка", "desc": "Оценка времени фальцовки", "cat": "Отделка"}, {"key": "binding", "title": "Переплёт", "desc": "Стоимость переплёта", "cat": "Отделка"}, {"key": "die-cutting", "title": "Вырубка", "desc": "Стоимость вырубки", "cat": "Отделка"}, {"key": "sheet-cost", "title": "Стоимость листа", "desc": "Стоимость партии листов", "cat": "Материалы"}, {"key": "print-click", "title": "Стоимость отпечатка", "desc": "Стоимость печати по отпечаткам", "cat": "Печать"}, {"key": "target-margin", "title": "Цена по марже", "desc": "Цена продажи по целевой марже", "cat": "Финансы"}, {"key": "breakeven", "title": "Точка безубыточности", "desc": "Минимальный объём продаж", "cat": "Финансы"}, {"key": "equipment-roi", "title": "Окупаемость оборудования", "desc": "Срок возврата инвестиций", "cat": "Бизнес"}, {"key": "area", "title": "Печатная площадь", "desc": "Расчёт площади печати", "cat": "Производство"}];
let currentKey=null;

function esc(v){
return String(v)
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
}

function money(v){
return new Intl.NumberFormat(
"ru-RU",
{
style:"currency",
currency:"RUB",
maximumFractionDigits:2
}
).format(v)
}

function n(name){
const e=document.getElementById("f_"+name);
return e?Number(e.value||0):0
}

function renderCards(){
const q=(document.getElementById("search").value||"").toLowerCase();

const list=CATALOG.filter(x=>
(x.title+" "+x.desc+" "+x.cat)
.toLowerCase()
.includes(q)
);

document.getElementById("cards").innerHTML=list.length?
list.map(x=>`
<article class="card">
<div>
<span class="tag">${esc(x.cat)}</span>
<h3>${esc(x.title)}</h3>
<p>${esc(x.desc)}</p>
</div>
<div class="card-bottom">
<small style="color:#9ba9bf">Быстрый расчёт</small>
<button class="small-btn" onclick="openCalc('${x.key}')">
Рассчитать
</button>
</div>
</article>
`).join("")
:
"<div style='color:#9ba9bf'>Ничего не найдено.</div>";
}

const FIELDS={
cost:[
["qty","Количество","1000"],
["unit","Себестоимость 1 шт., ₽","10"],
["price","Цена 1 шт., ₽","18"]
],
paper:[
["sheets","Листов","500"],
["price","Цена листа, ₽","12"]
],
layout:[
["sheetW","Ширина листа, мм","320"],
["sheetH","Высота листа, мм","450"],
["itemW","Ширина изделия, мм","90"],
["itemH","Высота изделия, мм","50"]
],
waste:[
["qty","Тираж","10000"],
["waste","Запас, %","7"]
],
margin:[
["cost","Себестоимость, ₽","10000"],
["revenue","Выручка, ₽","18000"]
],
weight:[
["qty","Листов","1000"],
["gsm","Плотность, г/м²","130"],
["width","Ширина, мм","320"],
["height","Высота, мм","450"]
],
time:[
["qty","Изделий","10000"],
["speed","Скорость, шт/час","3000"]
],
ink:[
["area","Площадь, м²","100"],
["grams","Расход, г/м²","1.5"],
["price","Цена, ₽/кг","900"]
],
"business-cards":[
["qty","Визиток","1000"],
["cost","Себестоимость тиража, ₽","1800"],
["price","Цена тиража, ₽","3500"]
],
labels:[
["qty","Этикеток","5000"],
["width","Ширина, мм","80"],
["height","Высота, мм","50"],
["price","Материал, ₽/м²","500"]
],
lamination:[
["area","Площадь, м²","30"],
["price","Цена, ₽/м²","120"]
],
folding:[
["qty","Изделий","5000"],
["speed","Скорость, шт/час","2500"]
],
binding:[
["qty","Изделий","1000"],
["unit","Переплёт, ₽/шт","8"]
],
"die-cutting":[
["qty","Изделий","10000"],
["unit","Вырубка, ₽/шт","0.7"]
],
"sheet-cost":[
["qty","Листов","1000"],
["price","Цена листа, ₽","14"]
],
"print-click":[
["qty","Отпечатков","10000"],
["click","Цена отпечатка, ₽","1.2"]
],
"target-margin":[
["cost","Себестоимость, ₽","10000"],
["margin","Маржа, %","35"]
],
breakeven:[
["fixed","Постоянные затраты, ₽","300000"],
["price","Цена единицы, ₽","100"],
["variable","Переменные затраты, ₽/шт","60"]
],
"equipment-roi":[
["invest","Инвестиции, ₽","3000000"],
["profit","Доп. прибыль/мес., ₽","180000"]
],
area:[
["qty","Количество","1000"],
["width","Ширина, мм","210"],
["height","Высота, мм","297"]
]
};

function openCalc(key){
currentKey=key;

const item=CATALOG.find(x=>x.key===key);
const fields=FIELDS[key]||[];

document.getElementById("modalBody").innerHTML=`
<div class="eyebrow">${esc(item.cat)}</div>
<h2>${esc(item.title)}</h2>
<p style="color:#9ba9bf">${esc(item.desc)}</p>

<form id="calcForm" onsubmit="calculate(event)">
<div class="grid">

${fields.map(f=>`
<div class="field">
<label>${esc(f[1])}</label>
<input
id="f_${f[0]}"
type="number"
value="${f[2]}"
min="0"
step="any"
required
>
</div>
`).join("")}

</div>

<button
class="btn primary"
type="submit"
style="width:100%;margin-top:12px"
>
Рассчитать
</button>

</form>

<div id="result"></div>
`;

document.getElementById("modal").classList.add("show");
}

function closeModal(){
document.getElementById("modal").classList.remove("show")
}

function backdrop(e){
if(e.target.id==="modal")closeModal()
}

function calculate(e){
e.preventDefault();

let v=0;
let title="";
let details="";
let isMoney=true;

switch(currentKey){

case "cost":{
const c=n("qty")*n("unit");
const r=n("qty")*n("price");
v=r-c;
title="Прибыль";
details=`Себестоимость: ${money(c)} · Выручка: ${money(r)}`;
break;
}

case "paper":
v=n("sheets")*n("price");
title="Стоимость бумаги";
break;

case "layout":{
const c=Math.floor(n("sheetW")/Math.max(1,n("itemW")));
const r=Math.floor(n("sheetH")/Math.max(1,n("itemH")));
v=Math.max(0,c*r);
title="Изделий на листе";
details=`Раскладка ${c} × ${r}`;
isMoney=false;
break;
}

case "waste":
v=n("qty")*(1+n("waste")/100);
title="Необходимый запуск";
details="с учётом технологического запаса";
isMoney=false;
break;

case "margin":
v=n("revenue")?
((n("revenue")-n("cost"))/n("revenue"))*100:0;
title="Маржа";
details=`Прибыль: ${money(n("revenue")-n("cost"))}`;
isMoney=false;
break;

case "weight":
v=n("qty")*n("gsm")*(n("width")/1000)*(n("height")/1000)/1000;
title="Вес тиража";
details="кг";
isMoney=false;
break;

case "time":
v=n("qty")/Math.max(1,n("speed"));
title="Время производства";
details="часов";
isMoney=false;
break;

case "ink":
v=n("area")*n("grams")*n("price")/1000;
title="Стоимость краски";
break;

case "business-cards":
v=n("price")-n("cost");
title="Прибыль с тиража";
break;

case "labels":
v=n("qty")*n("width")*n("height")/1000000*n("price");
title="Стоимость материала";
break;

case "lamination":
v=n("area")*n("price");
title="Стоимость ламинации";
break;

case "folding":
v=n("qty")/Math.max(1,n("speed"));
title="Время фальцовки";
details="часов";
isMoney=false;
break;

case "binding":
v=n("qty")*n("unit");
title="Стоимость переплёта";
break;

case "die-cutting":
v=n("qty")*n("unit");
title="Стоимость вырубки";
break;

case "sheet-cost":
v=n("qty")*n("price");
title="Стоимость листов";
break;

case "print-click":
v=n("qty")*n("click");
title="Стоимость печати";
break;

case "target-margin":
v=n("margin")<100?n("cost")/(1-n("margin")/100):0;
title="Цена продажи";
break;

case "breakeven":{
const contribution=n("price")-n("variable");
v=contribution>0?n("fixed")/contribution:0;
title="Точка безубыточности";
details="единиц";
isMoney=false;
break;
}

case "equipment-roi":
v=n("invest")/Math.max(1,n("profit"));
title="Окупаемость";
details="месяцев";
isMoney=false;
break;

case "area":
v=n("qty")*n("width")*n("height")/1000000;
title="Печатная площадь";
details="м²";
isMoney=false;
break;
}

const display=isMoney?
money(v):
Number(v.toFixed(2)).toLocaleString("ru-RU");

document.getElementById("result").innerHTML=`
<div class="result">
<div style="color:#9ba9bf;font-size:12px">
${esc(title)}
</div>
<strong>${display}</strong>

${
details?
`<div style="color:#9ba9bf;margin-top:6px">${esc(details)}</div>`:
""
}

</div>

<button
class="btn"
style="width:100%;margin-top:10px"
onclick="saveCalc('${title}','${display.replaceAll("'","")}')"
>
Сохранить расчёт
</button>
`;
}

function saveCalc(title,result){

let h=JSON.parse(
localStorage.getItem("pc_history")||"[]"
);

h.unshift({
title:title,
result:result,
date:new Date().toLocaleString("ru-RU")
});

localStorage.setItem(
"pc_history",
JSON.stringify(h.slice(0,30))
);

renderHistory();
}

function renderHistory(){

const h=JSON.parse(
localStorage.getItem("pc_history")||"[]"
);

const host=document.getElementById(
"historyList"
);

host.innerHTML=h.length?
h.map(x=>`
<div class="history-item">
<div>
<strong>${esc(x.title)}</strong>
<br>
<small>${esc(x.date)}</small>
</div>
<strong>${esc(x.result)}</strong>
</div>
`).join("")
:
"<div style='color:#9ba9bf'>История пока пуста.</div>";
}

function clearHistory(){
localStorage.removeItem("pc_history");
renderHistory();
}

renderCards();
renderHistory();
