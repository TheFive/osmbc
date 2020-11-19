

function fixLength(text, len, fillChar) {
  let result = text;
  if (typeof text === "undefined") result = "";
  if (text === null) result = "";
  for (let i = result.length; i < len; i++) {
    result = result + fillChar;
  }
  return result;
}

function md_table(json,columns) {

  for (let c of columns) {
    let c_min = c.name.length;
    for (o of json) {
      if (o[c.field] && o[c.field].length > c_min) c_min = o[c.field].length;
    }
    c.displayLength = c_min;
  }
  let md="";
  // Generate Markdown Header
  for (let c of columns) {
    md = md +"|";
    md = md + fixLength(c.name,c.displayLength," ");
  }
  md = md + "|\n";
  // generate Markdown Line
  for (c of columns) {
    md = md +"|";
    md = md + fixLength("",c.displayLength,"-");
  }
  md = md + "|\n";
  // Generate rest

  for (o of json) {
    for (c of columns) {
      md = md +"|";
      md = md + fixLength(o[c.field],c.displayLength," ");
    }
    md = md + "|\n";
  }
  return md;
}

module.exports.md_table = md_table;
