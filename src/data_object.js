// This class does all the heavy lifting.
// It takes the and can format it into csv
window.DataObject = class DataObject {
  constructor() {
    this.base_json = null;
  }

  // Parse base csv file as JSON. This will be easier to work with.
  // It uses http://papaparse.com/ for handling parsing
  parseCsv(csv, encoding, startAtRow=1, delimiter=null) {
    let existingHeaders = [];
    let config = {
      header: true,
      skipEmptyLines: true,
      beforeFirstChunk: function(chunk) {
        let rows = chunk.split("\n");
        let startIndex = startAtRow - 1;
        rows = rows.slice(startIndex);
        return rows.join("\n");
      },
      transformHeader: function(header) {
        if (header.trim().length == 0) {
          header = "Unnamed column";
        }
        if (existingHeaders.indexOf(header) != -1) {
          let new_header = header;
          let counter = 0;
          while(existingHeaders.indexOf(new_header) != -1){
            counter++;
            new_header = header + " (" + counter + ")";
          }
          header = new_header;
        }
        existingHeaders.push(header);
        return header;
      }
    }
    if (delimiter !== null) {
      config.delimiter = delimiter
    }
    let result = Papa.parse(csv, config);
    return (this.base_json = result);
  }

  fields() {
    return this.base_json.meta.fields;
  }

  rows() {
    return this.base_json.data;
  }

  // This method converts base_json into a json file with YNAB specific fields based on
  //   which fields you choose in the dropdowns in the browser.

  // --- parameters ----
  // limit: expects an integer and limits how many rows get parsed (specifically for preview)
  //     pass in false or null to do all.
  // lookup: hash definition of YNAB column names to selected base column names. Lets us
  //     convert the uploaded CSV file into the columns that YNAB expects.
  // inverted_outflow: if true, positive values represent outflow while negative values represent inflow
  converted_json(limit, ynab_cols, lookup, useOptions, exchangeOptions) {
    const {invertedOutflow, exchange} = useOptions
    let {currency, bankCurrency, fallbackRate = 1, rate, from, to} = exchangeOptions
    
    if (!fallbackRate) {
      fallbackRate = 1;
    } else {
      fallbackRate = Number(fallbackRate);
    }

    if (!currency) {
      currency = bankCurrency
    }

    let value;
    if (this.base_json === null) {
      return null;
    }
    value = [];
    // TODO: You might want to check for errors. Papaparse has an errors field.
    if (this.base_json.data) {
      this.base_json.data.forEach(function (row, index) {
        let tmp_row, isExchanged;
        if (!limit || index < limit) {
          isExchanged = ""
          tmp_row = {};
          ynab_cols.forEach(function (col) {
            let cell;
            cell = row[lookup[col]];
            // Some YNAB columns need special formatting,
            //   the rest are just returned as they are.
            if (cell) {
              if (['Outflow', 'Inflow'].includes(col)) {
                if (lookup['Outflow'] == lookup['Inflow']) {
                  if (invertedOutflow === (col === 'Outflow')) {
                    tmp_row[col] = cell.startsWith('-') ? "" : cell;
                  } else {
                    tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : "";
                  }
                } else {
                  tmp_row[col] = cell;
                }
              } else {
                tmp_row[col] = cell;
              }

              if (['Inflow', 'Outflow', 'Amount'].includes(col) && tmp_row[col]) {
                let cellValue = Number(tmp_row[col])

                if (isNaN(cellValue)) {
                  cellValue = tmp_row[col].replace(/[^\d\.,-]/g, "");
                  const periodIndex = cellValue.indexOf(".");
                  const commaIndex = cellValue.indexOf(",");
                  if (commaIndex !== -1 && periodIndex !== -1) {
                    if (commaIndex > periodIndex) {
                      cellValue = cellValue.replace(/\./g, "").replace(",", ".");
                    } else {
                      cellValue = cellValue.replace(/,/g, "");
                    }
                  } else if (commaIndex !== -1) {
                    cellValue = cellValue.replace(",", ".");
                  }
                  cellValue = Number(cellValue);
                }
                if (isNaN(cellValue)) {
                  tmp_row[col] = "";
                  return;
                }

                if (lookup['Outflow'] == lookup['Inflow'] && col === 'Outflow') {
                  cellValue *= -1
                }

                let exchangedValue = cellValue
                
                if (exchange) {
                  const fromValue = row[from]
                  const toValue = row[to]
                  let rateValue = row[rate]

                  rateValue = rateValue && !isNaN(Number(rateValue)) ? Number(rateValue) : fallbackRate
  
                  // console.log('exchange', fromValue, toValue, currency, rateValue, tmp_row[col], cellValue, exchangeOptions, row);
                  if (bankCurrency === currency) {
                    isExchanged = ""
                    exchangedValue = cellValue;
                  } else if (fromValue === currency) {
                    isExchanged = `${currency}->${toValue}:${rateValue}`
                    exchangedValue = cellValue / rateValue;
                  } else if (toValue === currency) {
                    isExchanged = `${fromValue}->${currency}:${rateValue}`
                    exchangedValue = cellValue * rateValue;
                  } else if (fromValue !== toValue) {
                    isExchanged = `${fromValue}->${toValue}:${rateValue}|${currency}:${fallbackRate}`
                    exchangedValue = cellValue * rateValue;
                    if (toValue === bankCurrency) {
                      exchangedValue = cellValue * rateValue * fallbackRate;
                    } else if (fromValue === bankCurrency) {
                      exchangedValue = cellValue * fallbackRate;
                    }
                  } else {
                    isExchanged = `${bankCurrency}->${currency}:${rateValue}`
                    exchangedValue = cellValue * rateValue;
                  }

                  if (rateValue === 1) isExchanged = ''
                }

                tmp_row[col] = +exchangedValue.toFixed(2);
              }
            }
          });
          if (isExchanged) {
            tmp_row["Memo"] = `[${isExchanged}] ${tmp_row["Memo"] || ""}`
          }
          value.push(tmp_row);
        }
      });
    }
    return value;
  }

  converted_csv(limit, ynab_cols, lookup, useOptions, exchangeOptions) {
    const {invertedOutflow, exchange} = useOptions
    let string;
    if (this.base_json === null) {
      return nil;
    }
    // Papa.unparse string
    string = '"' + ynab_cols.join('","') + '"\n';
    this.converted_json(limit, ynab_cols, lookup, useOptions, exchangeOptions).forEach(function (row) {
      let row_values;
      row_values = [];
      ynab_cols.forEach(function (col) {
        let row_value;
        row_value = row[col] || "";
        // escape text which might already have a quote in it
        if (typeof row_value === 'string') {
          row_value = row_value.replace(/"/g, '""').trim();
        }
        return row_values.push(row_value);
      });
      return (string += '"' + row_values.join('","') + '"\n');
    });
    return string;
  }
};