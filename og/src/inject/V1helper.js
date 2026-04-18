/**
 * @author Riley Brust <brust.developer@gmail.com>
 * @version 0.1.0
 * @description Helper functions to add prices to the page.
 * @file helper.js
 */

function addPrices(labor){
    // Only query price elements on known sites to limit DOM work.
    const url = document.URL;
    let elements = [];
    if (url.includes('sentrix') || url.includes('defenders') || url.includes('cpr')) {
        elements = Array.from(document.getElementsByClassName('price'));
    }

    // Loop through price elements and add calculated prices.
    for (const part_item of elements) {
        if (!part_item) continue;

        const parent = part_item.parentElement;
        const parentclass = parent ? parent.className : '';
        // Skip sale or cart prices
        if (parentclass === 'old-price' || parentclass === 'np-cart') continue;

        addHTML(labor, part_item, url);
    }
}


function calcRepair(partcost,labor){
    const pc = Number(partcost) || 0;
    let mult = 1;

    if (pc <= 9.99) {
        mult = 5;
    } else if (pc >= 10 && pc <= 24.99) {
        mult = 2.5;
    } else if (pc >= 25 && pc <= 49.99) {
        mult = 2.25;
    } else if (pc >= 50 && pc <= 99.99) {
        mult = 2.0;
    } else if (pc >= 100 && pc <= 199.99) {
        mult = 1.5;
    } else if (pc >= 200) {
        mult = 1.25;
    }

    const price = (pc * mult) + Number(labor || 0);
    const rounded = Math.ceil(price / 10) * 10;
    return Math.round(rounded) - 0.01;
}