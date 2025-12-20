/**
 * @author Riley Brust <brust.developer@gmail.com>
 * @version 0.1.0
 * @description Helper functions to add prices to the page.
 * @file helper.js
 */


// v1
// function addPrices(labor){
//     var elements;
//     //Loop for adding prices
//     let url = document.URL;
//     if(url.includes("sentrix") || url.includes("defenders") || url.includes("cpr"))    elements = document.getElementsByClassName("price");
    
//     for(const part_item of elements){   
//         console.log(part_item)
//         //Looping through each price element on the page.
//         let parentclass = part_item.parentElement.className;
//         if(parentclass == "old-price" || parentclass == "np-cart") continue; 
//            //skip if the price is a sale item on MD.

//         //Checking if the parent class is one that would contain parts or skipping if its another price. EX: the cart price.
//         let parentClass4 = part_item.parentElement.parentElement.parentElement.parentElement;
//         let parentClass3 = part_item.parentElement.parentElement.parentElement;
    
        
//         addHTML(labor,part_item,url);
//     }
// }

// v2
function getLaborSingle(part_item, baseLabor, config) {
  let perItemLabor = Number(baseLabor) || 0;
  const adv = config.advanced;


  let container =
    part_item.closest("li.item, .product-item, .item, .product-view, .product-essential");

  let heading = container
    ? container.querySelector("h2.product-name, h1, .product-name, .page-title")
    : null;

  if (!heading) {
    heading = document.querySelector("h1, h2.product-name, .product-name, .page-title");
  }

  if (!heading) return perItemLabor;

  const name = heading.textContent.toLowerCase();

  if (name.includes("casper")) {
    perItemLabor = 0;
  }
  else if (name.includes("soldering required")) {
    perItemLabor = adv.soldering;
  } else if (name.includes("charging") && name.includes("port")) {
  perItemLabor = adv.chargePort;
  } else if (name.includes("back") && name.includes("housing")) {
    perItemLabor = adv.backHousing;
  }

  return perItemLabor;
}

function addPrices(baseLabor, config) {
  const url = document.URL;
  if (!(url.includes("sentrix") || url.includes("defenders") || url.includes("cpr"))) return;

  const elements = document.getElementsByClassName("price");

  for (const part_item of elements) {
    // Skip cart / checkout
    if (
      part_item.closest("#np-cart") ||
      part_item.closest(".np-cart") ||
      part_item.closest(".cart") ||
      part_item.closest(".minicart") ||
      part_item.closest(".checkout")
    ) {
      continue;
    }

    // Skip already-processed nodes
    if (part_item.dataset.cprCalcApplied === "1") continue;

    const perItemLabor = getLaborSingle(part_item, baseLabor, config);
    addHTML(perItemLabor, part_item, url);
    part_item.dataset.cprCalcApplied = "1";
  }
}




function calcRepair(partcost,labor){
	var mult;
	if(partcost <= 9.99){
		mult = 5;
	}else if(partcost >=10  &  partcost <= 24.99) {
		mult = 2.5;
	}else if(partcost >=25  &  partcost <= 49.99) {
		mult =2.25;
	}else if(partcost >=50  &  partcost <= 99.99) {
		mult = 2.00;
	}else if(partcost >=100 &  partcost <= 199.99){
		mult = 1.5;
	}else if(partcost >=200){
		mult =1.25;
	}
        var price = (partcost * mult) + labor;
        var rounded = Math.ceil(price / 10) * 10;
	return Math.round(rounded) - .01;
}

module.exports = { calcRepair };