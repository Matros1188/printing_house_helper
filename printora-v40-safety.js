(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const num=v=>{const n=Number(String(v??"").replace(/\s/g,"").replace(/,/g,"."));return Number.isFinite(n)?n:0;};
  const text=v=>String(v??"").trim();
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmt=v=>Number(v||0).toLocaleString("ru-RU",{maximumFractionDigits:2});
  const schemaError=e=>{const s=`${e?.code||""} ${e?.message||e?.details||e||""}`;return /PGRST205|42P01|schema cache|relation .*does not exist|could not find the table/i.test(s);};
  function friendlyError(error){
    const s=`${error?.code||""} ${error?.message||error?.details||error||""}`;
    if(schemaError(error)) return "Облачный справочник ещё не настроен. Один раз выполните PRINTORA_V40_SUPABASE_MIGRATION.sql в Supabase → SQL Editor, затем обновите страницу.";
    if(/23505|duplicate key|unique constraint/i.test(s)) return "Такая запись уже существует. Проверьте номер заказа или название материала/станка.";
    if(/JWT|token|session/i.test(s)) return "Сессия аккаунта устарела. Войдите в аккаунт заново.";
    return String(error?.message||error?.details||"Не удалось выполнить операцию.");
  }
  window.PRINTORA_IS_SCHEMA_ERROR=schemaError;
  window.PRINTORA_FRIENDLY_ERROR=friendlyError;
  window.PRINTORA_HANDLE_CLOUD_ERROR=(error,context="Облако")=>{if(schemaError(error)){window.PRINTORA_TOAST?.(`${context}: справочник временно работает локально. Выполните миграцию PRINTORA_V40_SUPABASE_MIGRATION.sql.` ,"error");return true;}return false;};
  function repeatMm(value){
    if(typeof window.PRINTORA_REPEAT_MM==="function"){const n=Number(window.PRINTORA_REPEAT_MM(value));if(Number.isFinite(n)&&n>0)return n;}
    const raw=text(value).toLocaleLowerCase("ru-RU").replace(/,/g,".");
    const m=raw.match(/^([-+]?\d+(?:\.\d+)?)\s*(зуб(?:а|ов)?|teeth|tooth|мм|mm)?$/i);
    if(!m)return 0; const n=Number(m[1]); if(!Number.isFinite(n)||n<=0)return 0;
    return /зуб|teeth|tooth/i.test(m[2]||"")?n*3.175:n;
  }
  window.PRINTORA_LAYOUT_GEOMETRY=(values={})=>{
    const width=num(values.width??$("width")?.value), web=num(values.web??$("web")?.value), streams=Math.floor(num(values.streams??$("streams")?.value)), margin=Math.max(0,num(values.sideMargin??$("sideMargin")?.value)), gap=Math.max(0,num(values.labelGap??$("labelGap")?.value));
    const max=width>0&&web>0&&width+gap>0?Math.max(0,Math.floor((web-2*margin+gap+1e-9)/(width+gap))):0;
    const used=streams>0?streams*width+Math.max(0,streams-1)*gap+2*margin:0;
    return {width,web,streams,margin,gap,maxStreams:max,used};
  };
  function validateCommon(){
    const errors=[]; const qty=num($("qty")?.value), streamsRaw=num($("streams")?.value), width=num($("width")?.value), height=num($("height")?.value), web=num($("web")?.value), repeat=repeatMm($("repeat")?.value), gsm=num($("gsm")?.value), colors=num($("colors")?.value), inkPrice=num($("inkPrice")?.value), inkUse=num($("inkUse")?.value), waste=num($("waste")?.value);
    const selected=window.PRINTORA_MATERIAL||null; const matPrice=selected&&num(selected.priceM2)>0?num(selected.priceM2):num($("matPrice")?.value);
    if(qty<=0)errors.push("Укажите тираж больше нуля.");
    if(!Number.isInteger(streamsRaw)||streamsRaw<1)errors.push("Ручьи должны быть целым числом от 1.");
    if(width<=0)errors.push("Укажите ширину этикетки больше нуля.");
    if(height<=0)errors.push("Укажите высоту этикетки больше нуля.");
    if(web<=0)errors.push("Укажите ширину полотна материала.");
    if(web>0&&width>0&&web<width)errors.push(`Ширина полотна ${fmt(web)} мм меньше ширины этикетки ${fmt(width)} мм.`);
    if(repeat<=0)errors.push("Укажите раппорт больше нуля. Например: 63,5 мм или 20 зубьев.");
    if(gsm<=0)errors.push("Укажите граммаж материала больше нуля.");
    if(matPrice<=0)errors.push("Укажите цену материала больше нуля.");
    if(!Number.isInteger(colors)||colors<1)errors.push("Количество цветов должно быть целым числом от 1.");
    if(inkPrice<=0)errors.push("Укажите цену краски больше нуля.");
    if(inkUse<=0)errors.push("Укажите расход краски больше нуля.");
    if(waste<0||waste>100)errors.push("Отходы должны быть от 0 до 100%.");
    const g=window.PRINTORA_LAYOUT_GEOMETRY(); if(g.streams>0&&g.width>0&&g.web>0&&g.streams>g.maxStreams)errors.push(`Невозможная раскладка: задано ${g.streams} ручьёв, максимум ${g.maxStreams} при данной ширине полотна.`);
    return {ok:errors.length===0,errors,repeat,matPrice,layout:g};
  }
  function validateDetail(){
    const base=validateCommon(); const errors=base.errors.slice();
    const machineId=text($("machineSelect")?.value), manualSpeed=num($("speed")?.value), speed=num($("speed")?.value), power=num($("power")?.value), setup=num($("setup")?.value), machineRate=num($("machine")?.value), labor=num($("labor")?.value), powerRate=num($("powerRate")?.value);
    const hasMachine=Boolean(machineId); if(!hasMachine&&manualSpeed<=0)errors.push("Выберите станок или заполните производственные параметры вручную.");
    if(speed<=0)errors.push("Скорость станка должна быть больше нуля.");
    if(power<=0)errors.push("Мощность станка должна быть больше нуля.");
    if(setup<0)errors.push("Время наладки не может быть отрицательным.");
    if(machineRate<=0)errors.push("Ставка станка должна быть больше нуля.");
    if(labor<=0)errors.push("Ставка труда должна быть больше нуля.");
    if(powerRate<=0)errors.push("Тариф электроэнергии должен быть больше нуля.");
    const lamEnabled=Boolean($("lamEnabled")?.checked), dieEnabled=Boolean($("dieEnabled")?.checked);
    if(lamEnabled&&num($("lam")?.value)<=0)errors.push("Для ламинации укажите цену больше нуля.");
    if(dieEnabled&&num($("die")?.value)<=0)errors.push("Для вырубки укажите цену больше нуля.");
    if(num($("overhead")?.value)<0||num($("admin")?.value)<0)errors.push("Накладные и административные расходы не могут быть отрицательными.");
    if(num($("extraCost")?.value)<0)errors.push("Дополнительные расходы не могут быть отрицательными.");
    if(num($("markup")?.value)<0)errors.push("Наценка не может быть отрицательной.");
    return {...base,ok:errors.length===0,errors};
  }
  function showErrors(errors,title="Расчёт остановлен"){
    const box=$("result"); if(!box)return; const list=[...new Set(errors||[])]; box.innerHTML=`<div class="printora-safety-error-v40"><strong>${esc(title)}</strong><ul>${list.slice(0,8).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; window.PRINTORA_TOAST?.(list[0],"error");
  }
  function smoothVolumeMarkup(qty){
    const x=Math.max(1,num(qty)), p=[[1,0],[5000,0],[15000,9],[50000,16],[100000,22]];
    if(x<=p[0][0])return 0; for(let i=1;i<p.length;i++){if(x<=p[i][0]){const [x0,y0]=p[i-1],[x1,y1]=p[i],t=(x-x0)/(x1-x0);return y0+(y1-y0)*t;}} return 22;
  }
  function getSelectedMachine(id){return window.PRINTCALC_MACHINES?.getById?.(id)||null;}
  window.PRINTORA_VALIDATE_COMMON=validateCommon;
  window.PRINTORA_VALIDATE_DETAIL=validateDetail;
  window.PRINTORA_SHOW_CALC_ERRORS=showErrors;
  window.PRINTORA_SMOOTH_VOLUME_MARKUP=smoothVolumeMarkup;
  window.PRINTORA_SAFETY={validateCommon,validateDetail,showErrors,smoothVolumeMarkup,getLayout:window.PRINTORA_LAYOUT_GEOMETRY,friendlyError};
  window.PRINTORA_QUICK_TO_DETAIL=(snapshot)=>{try{sessionStorage.setItem("PRINTORA_TRANSFER_DETAIL_V40",JSON.stringify(snapshot||{}));return true;}catch(_){return false;}};
  window.PRINTORA_APPLY_TRANSFER=()=>{
    const raw=sessionStorage.getItem("PRINTORA_TRANSFER_DETAIL_V40")||localStorage.getItem("printora_quick_to_detail_v40"); if(!raw)return false;
    try{const snap=JSON.parse(raw);sessionStorage.removeItem("PRINTORA_TRANSFER_DETAIL_V40");localStorage.removeItem("printora_quick_to_detail_v40"); if(typeof window.PRINTORA_APPLY_SNAPSHOT==="function")window.PRINTORA_APPLY_SNAPSHOT(snap); else window.PRINTCALC_PENDING_SNAPSHOT=snap; return true;}catch(_){return false;}
  };
  if(!window.__PRINTORA_V40_ERROR_HOOK){window.__PRINTORA_V40_ERROR_HOOK=true;window.addEventListener("printora:cloud-error",e=>window.PRINTORA_HANDLE_CLOUD_ERROR?.(e.detail?.error,e.detail?.context||"Облако"));}
})();
