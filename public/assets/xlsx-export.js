// Open XML export with embedded original profile screenshots; JSZip is vendored locally.
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
export async function exportAccountXlsx(rows, getProgress, meta, onProgress=()=>{}) {
  if (!rows.length) throw new Error('请先勾选账号');
  if (!window.JSZip) throw new Error('导出组件未加载，请刷新后重试');
  const zip = new window.JSZip();
  const headers = ['编号','主页截图','账号名称','小红书号','粉丝量','领域','负责人','建联状态','首次建联时间','最近跟进时间','下次跟进日期','备注','账号主页链接','状态核对日期','记录更新时间'];
  const widths = [8,50,28,25,12,18,16,24,24,24,18,40,48,18,24];
  const sheetRows = [
    `<row r="1" ht="28" customHeight="1">${cell('A',1,'JEV · 选中账号建联清单',1)}</row>`,
    `<row r="2" ht="32" customHeight="1">${cell('A',2,`共 ${rows.length} 个账号 · 主页采集 ${meta.profilesSnapshot} · 粉丝为采集日约数 · 时间按北京时间填写 · 空白表示待补充 · 本文件可用于反馈，不会自动回写网站`,5)}</row>`,
    `<row r="3" ht="28" customHeight="1">${headers.map((v,i)=>cell(String.fromCharCode(65+i),3,v,2)).join('')}</row>`
  ];
  const anchors=[],links=[],relations=[];
  for (let i=0;i<rows.length;i++) {
    const r=rows[i], p=getProgress(r.order), n=i+4;
    onProgress(i+1,rows.length);
    const response=await fetch(r.image,{credentials:'same-origin'});
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`无法读取 ${r.name} 的主页截图，请确认登录后重试`);
    const blob=await response.blob(), bitmap=await createImageBitmap(blob);
    const scale=Math.min(340/bitmap.width,190/bitmap.height);
    const cx=Math.round(bitmap.width*scale*9525),cy=Math.round(bitmap.height*scale*9525);
    bitmap.close();
    zip.file(`xl/media/profile${i+1}.jpg`,await blob.arrayBuffer());
    anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>${n-1}</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="${xml(r.name)} 主页截图"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
    relations.push(`<Relationship Id="rId${i+1}" Type="${officeRel}image" Target="../media/profile${i+1}.jpg"/>`);
    const modified=p.updatedAt ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(p.updatedAt)).replace(' ','T') : '';
    const values=[String(r.order).padStart(3,'0'),'',r.name,r.redId,r.fans,r.group,p.owner,p.status,excelDate(p.firstContactAt),excelDate(p.lastContactAt),excelDate(p.nextFollowUpAt),p.note,r.profile,excelDate(r.statusVerifiedAt||''),excelDate(modified)];
    sheetRows.push(`<row r="${n}" ht="155" customHeight="1">${values.map((v,c)=>cell(String.fromCharCode(65+c),n,v,c===4?6:[8,9,14].includes(c)?3:[10,13].includes(c)?4:[0,3].includes(c)?7:c===12?8:0,[4,8,9,10,13,14].includes(c))).join('')}</row>`);
    links.push(`<hyperlink ref="M${n}" r:id="rIdLink${i+1}"/>`);
  }
  zip.file('[Content_Types].xml',declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  zip.file('_rels/.rels',declaration+`<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${officeRel}officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml',declaration+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRel.slice(0,-1)}"><sheets><sheet name="建联清单" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${officeRel}worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeRel}styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml',declaration+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="16"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font><font><color rgb="FFCF1736"/><u/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF333333"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${[{}, {fontId:1}, {fontId:2,fillId:2}, {numFmtId:164}, {numFmtId:165}, {}, {numFmtId:3}, {numFmtId:49}, {fontId:3}].map(v=>`<xf numFmtId="${v.numFmtId||0}" fontId="${v.fontId||0}" fillId="${v.fillId||0}" borderId="0" xfId="0" applyAlignment="1"${v.numFmtId?' applyNumberFormat="1"':''}><alignment vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml',declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRel.slice(0,-1)}"><dimension ref="A1:O${rows.length+3}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="3" topLeftCell="B4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A3:O${rows.length+3}"/><mergeCells count="2"><mergeCell ref="A1:O1"/><mergeCell ref="A2:O2"/></mergeCells><hyperlinks>${links.join('')}</hyperlinks><drawing r:id="rIdDrawing"/></worksheet>`);
  zip.file('xl/worksheets/_rels/sheet1.xml.rels',declaration+`<Relationships xmlns="${relNS}"><Relationship Id="rIdDrawing" Type="${officeRel}drawing" Target="../drawings/drawing1.xml"/>${rows.map((r,i)=>`<Relationship Id="rIdLink${i+1}" Type="${officeRel}hyperlink" Target="${xml(r.profile)}" TargetMode="External"/>`).join('')}</Relationships>`);
  zip.file('xl/drawings/drawing1.xml',declaration+`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRel.slice(0,-1)}">${anchors.join('')}</xdr:wsDr>`);
  zip.file('xl/drawings/_rels/drawing1.xml.rels',declaration+`<Relationships xmlns="${relNS}">${relations.join('')}</Relationships>`);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
