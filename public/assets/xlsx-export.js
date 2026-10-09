import {PLATFORMS,platformOf,codeOf,identityText,safeUrl} from './catalog.js';
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const relNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
function cell(column,row,value,style=0,numeric=false) {
  if (value === '' || value == null) return `<c r="${column}${row}" s="${style}"/>`;
  return numeric ? `<c r="${column}${row}" s="${style}"><v>${Number(value)}</v></c>` : `<c r="${column}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function excelDate(value) {
  if (!value) return '';
  // Preserve the Beijing wall-clock time shown in the tracker, without UTC shifting.
  return Date.parse(value.length === 10 ? value+'T00:00:00Z' : value+':00Z') / 86400000 + 25569;
}

export async function exportAccountXlsx(rows,getProgress,meta,onProgress=()=>{}) {
 if(!rows.length)throw new Error('请先勾选账号');
 if(!window.JSZip)throw new Error('导出组件未加载，请刷新重试');
 const zip=new window.JSZip(),overrides=[],workbookSheets=[],workbookRels=[];
 const headers=['编号','主页截图 / 封面','账号名称','平台账号 ID','粉丝量','领域','负责人','建联状态','首次建联时间','最近跟进时间','下次跟进日期','跟进备注','账号主页链接','资料核对日期','记录更新时间','平台','联系渠道','代表内容链接','资料来源','核实状态','联系人'];
 const widths=[18,50,28,28,12,20,16,24,24,24,18,40,48,18,24,18,18,48,48,16,30];
 let completed=0,sheetId=0;
 for(const [platform,info]of Object.entries(PLATFORMS)){
  const group=rows.filter(r=>platformOf(r)===platform);if(!group.length)continue;sheetId++;
  const sheetRows=[`<row r="1" ht="28" customHeight="1">${cell('A',1,'JEV · '+info.name+'建联清单',1)}</row>`,`<row r="2" ht="34" customHeight="1">${cell('A',2,`共 ${group.length} 个账号 · 未知指标留空 · 时间为北京时间；仅日期表示时刻未知 · 名单不会自动回写网站`,5)}</row>`,`<row r="3" ht="28" customHeight="1">${headers.map((v,i)=>cell(String.fromCharCode(65+i),3,i===3?info.idLabel:v,2)).join('')}</row>`];
  const anchors=[],imageRels=[],links=[],sheetRels=[];
  for(let i=0;i<group.length;i++){
   const r=group[i],p=getProgress(r.order),n=i+4;onProgress(++completed,rows.length);
   if(r.image){
    let blob;
    if(r.image.startsWith('data:image/')){
      const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(r.image);
      if(!match)throw new Error(r.name+' 的图片格式无效');
      blob=new Blob([Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))],{type:match[1]});
    }else{
      const response=await fetch(r.image,{credentials:'same-origin'});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error(`无法读取 ${r.name} 的截图，请确认登录后重试`);
      blob=await response.blob();
    }
    const bitmap=await createImageBitmap(blob);
    const scale=Math.min(340/bitmap.width,190/bitmap.height),cx=Math.round(bitmap.width*scale*9525),cy=Math.round(bitmap.height*scale*9525);bitmap.close();
    const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg',filename=`profile${sheetId}_${i}.${extension}`;
    zip.file('xl/media/'+filename,await blob.arrayBuffer());
    anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>${n-1}</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="${xml(r.name)} 资料截图"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
    imageRels.push(`<Relationship Id="rId${i+1}" Type="${officeRel}image" Target="../media/${filename}"/>`);
   }
   const modified=p.updatedAt?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(p.updatedAt)).replace(' ','T'):'';
   const values=[codeOf(r),r.image?'':'截图待补充',r.name,identityText(r),r.fans,r.group,p.owner,p.status,excelDate(p.firstContactAt),excelDate(p.lastContactAt),excelDate(p.nextFollowUpAt),p.note,r.profile,excelDate(r.verifiedAt||r.statusVerifiedAt||''),excelDate(modified),info.name,p.channel,r.caseUrl,r.source||'',r.verification||'已采集',r.contactPerson||''];
   sheetRows.push(`<row r="${n}" ht="${r.image?155:65}" customHeight="1">${values.map((v,c)=>cell(String.fromCharCode(65+c),n,v,c===4?6:c===8?(p.firstContactAt.length===10?4:3):c===9?(p.lastContactAt.length===10?4:3):c===14?3:[10,13].includes(c)?4:[0,3].includes(c)?7:[12,17].includes(c)?8:0,[4,8,9,10,13,14].includes(c))).join('')}</row>`);
   for(const [column,url]of [['M',r.profile],['R',r.caseUrl]])if(safeUrl(url)){const id='link'+column+n;links.push(`<hyperlink ref="${column}${n}" r:id="${id}"/>`);sheetRels.push(`<Relationship Id="${id}" Type="${officeRel}hyperlink" Target="${xml(safeUrl(url))}" TargetMode="External"/>`);}
  }
  if(anchors.length){
   sheetRels.push(`<Relationship Id="rIdDrawing" Type="${officeRel}drawing" Target="../drawings/drawing${sheetId}.xml"/>`);
   zip.file(`xl/drawings/drawing${sheetId}.xml`,declaration+`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRel.slice(0,-1)}">${anchors.join('')}</xdr:wsDr>`);
   zip.file(`xl/drawings/_rels/drawing${sheetId}.xml.rels`,declaration+`<Relationships xmlns="${relNS}">${imageRels.join('')}</Relationships>`);
   overrides.push(`<Override PartName="/xl/drawings/drawing${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  }
  zip.file(`xl/worksheets/sheet${sheetId}.xml`,declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRel.slice(0,-1)}"><dimension ref="A1:U${group.length+3}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="3" topLeftCell="B4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A3:U${group.length+3}"/><mergeCells count="2"><mergeCell ref="A1:U1"/><mergeCell ref="A2:U2"/></mergeCells>${links.length?`<hyperlinks>${links.join('')}</hyperlinks>`:''}${anchors.length?'<drawing r:id="rIdDrawing"/>':''}</worksheet>`);
  if(sheetRels.length)zip.file(`xl/worksheets/_rels/sheet${sheetId}.xml.rels`,declaration+`<Relationships xmlns="${relNS}">${sheetRels.join('')}</Relationships>`);
  overrides.push(`<Override PartName="/xl/worksheets/sheet${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  workbookSheets.push(`<sheet name="${info.name}" sheetId="${sheetId}" r:id="rId${sheetId}"/>`);workbookRels.push(`<Relationship Id="rId${sheetId}" Type="${officeRel}worksheet" Target="worksheets/sheet${sheetId}.xml"/>`);
 }
 zip.file('[Content_Types].xml',declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides.join('')}</Types>`);
 zip.file('_rels/.rels',declaration+`<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${officeRel}officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 zip.file('xl/workbook.xml',declaration+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRel.slice(0,-1)}"><sheets>${workbookSheets.join('')}</sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="${relNS}">${workbookRels.join('')}<Relationship Id="rIdStyles" Type="${officeRel}styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',declaration+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="16"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font><font><color rgb="FFCF1736"/><u/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF333333"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${[{}, {fontId:1}, {fontId:2,fillId:2}, {numFmtId:164}, {numFmtId:165}, {}, {numFmtId:3}, {numFmtId:49}, {fontId:3}].map(v=>`<xf numFmtId="${v.numFmtId||0}" fontId="${v.fontId||0}" fillId="${v.fillId||0}" borderId="0" xfId="0" applyAlignment="1"${v.numFmtId?' applyNumberFormat="1"':''}><alignment vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
