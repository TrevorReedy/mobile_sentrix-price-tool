/**
 * @author Riley Brust <brust.developer@gmail.com>
 * @version 0.1.0
 * @description Chrome extention that displays repair cost in the websites.
 * @file inject.js
 */


function addHTML(labor, part_item, url) {
    const costText = part_item.textContent || '';
    const cost = costText.replace('$', '');
    const repair_price = calcRepair(Number(cost), labor);

    // Build a small table with Part Price, Labor, and Repair Price
    const partPrice =  Math.max(0, repair_price - Number(labor || 0));

    const table = document.createElement('table');
    table.className = 'repair-table';
    table.style.fontFamily = 'Arial, sans-serif';
    table.style.fontSize = '14px';

    const tbody = document.createElement('tbody');

    const makeRow = (label, value, valueClass) => {
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tdLabel.className = 'repair-table-label';
        const tdValue = document.createElement('td');
        tdValue.textContent = value;
        tdValue.className = valueClass || 'repair-table-value';
        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        return tr;
    };

    makeRow('Part Price:', '$' + partPrice.toFixed(2));
    tbody.appendChild(makeRow('Part Price:', '$' + partPrice.toFixed(2)));
    tbody.appendChild(makeRow('Labor:', '$' + Number(labor).toFixed(2)));
    tbody.appendChild(makeRow('Repair Price:', '$' + Number(repair_price).toFixed(2), 'repair-table-repair'));

    table.appendChild(tbody);

    const container = document.createElement('div');
    container.className = 'repair-container';
    if (!url.includes('replacement-parts') && url.includes('cpr.parts')) {
        const spacer = document.createElement('br');
        container.appendChild(spacer);
    }
    container.appendChild(table);

    const parent = part_item.parentElement;
    if (parent) parent.appendChild(container);
}


function main(){
    //Check to see if were on a parts page or another page.
    let url = document.URL;
    const blacklist = ["tools","brands/","refurbishing","accessories","checkout"];
    if(blacklist.some((word) => url.includes(word))) return;

    //Set Labor
    const tablets   = ["ipad","surface","galaxy-tab","samsung/tab"];
    const consoles  = ["game-console","sony","xbox","nintendo","macbook-parts"];
    var labor = 75;
    if(tablets.some((word) => url.includes(word)))   labor = 100;
    if(consoles.some((word)=> url.includes(word)))   labor = 130;
 
    addPrices(labor);
}

main();