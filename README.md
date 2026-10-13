# Cart Compare

Compare shopping carts side by side: list some products, pick a combination per scenario, see the totals.

**Live page:** [https://guyzmuch.github.io/cart-compare/](https://guyzmuch.github.io/cart-compare/)

> Side note: it was created to compare pledge options on crowdfunding sites (Kickstarter, Gamefound…), where a base pledge comes with many add-ons.

## Examples

- A few items: [https://guyzmuch.github.io/cart-compare/?Laptop=999&Extra%20RAM=120&Bag=45,50&Mouse=29](https://guyzmuch.github.io/cart-compare/?Laptop=999&Extra%20RAM=120&Bag=45,50&Mouse=29)
- Same items, already picked: [https://guyzmuch.github.io/cart-compare/?Laptop=999&Extra%20RAM=120&Bag=45,50&Mouse=29&_sc=0.3x2,0.1.2](https://guyzmuch.github.io/cart-compare/?Laptop=999&Extra%20RAM=120&Bag=45,50&Mouse=29&_sc=0.3x2,0.1.2)
- Another set: [https://guyzmuch.github.io/cart-compare/?Espresso%20machine=349&Grinder=129&Milk%20jug=19,90&Cleaning%20kit=24](https://guyzmuch.github.io/cart-compare/?Espresso%20machine=349&Grinder=129&Milk%20jug=19,90&Cleaning%20kit=24)

## How it works

- **Adding items:** put them in the URL as `name=price` (`?Laptop=999&Bag=45,50`), or paste them in the text box below the table, one per line as `Name,price`, and click "Apply list". `€`, `$`, spaces and `12,50` are all accepted.
- **Picking:** each scenario is a column. Click `+` to add an item (click again for more copies), `−` to remove one. The total of each scenario is shown at the bottom, with the difference compared to scenario 1.
- **Saving:** everything is stored in the URL, so reloading keeps your choices and you can bookmark or share the link. The picks are in the `_sc` parameter: `_sc=0.3x2,0.1.2` means scenario 1 has item 0 and item 3 twice, scenario 2 has items 0, 1 and 2.

It's a single `index.html` file with no dependencies: you can also just download it and open it.

## Tests

```
npm install
npm test
```
