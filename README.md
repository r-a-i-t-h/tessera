# RecTem - Recursive Templates

## Original notes

```txt
1) DETERMINE RENDER ITEMS
    From starting item, traverse ancestors, add to renderItems, keep topmost as 'root'.
    Add starting item to renderItems.
    From starting item, recurse children, add to renderItems.
    Notes:
        renderItems will have children in tree-traversal order rather than depth order.
        renderItems is an indexed (rather than keyed) collection which at least ensures the parents come first.
        renderItems is a subset which contains only those items which are relevant given our starting item.
2) PARSE ITEMS AND CREATE ZONES
    Parse all renderItems, create renderZones.
    Notes:
        renderZone records its creator. The first item to specify a zone is the only creator.
        No duplicate zones.
3) ITERATE ITEMS - REGISTER ZONE CONTRIBUTIONS
    Iterate all renderItems, register their contribution to zones.
    The register* methods of the Rendering object allow steps 2 and 3 to be accomplished together.
4) ITERATE ZONES - IMPORT ITEM CONTENT
    Exploded content arrays are appended to Zone content array in contribItems order (which matches renderItems order).
5) FROM ROOT ITEM - RECURSIVE ZONE RENDER
    Notes:
        Once rendered, a Zone will return the cached HTML, it will not re-render each time.
        That allows a Zone to appear multiple times without duplicating content or processing.
        It also stops infinite loops between Zones which contain each other.

Notes: 
    Defensive checking - Items might reference Zones which are not present.
    I originally had both Zones and Items appearing as tokens.
    But Items don't have direct output - they merely provide content for Zones. So there is no concept of an Item 'going here'.
    Therefore an Item may reference a list of *related* Items but this will be a simple list, not included as tokens.
```
