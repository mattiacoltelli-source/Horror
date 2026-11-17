// Cambia solo gli oggetti del render annidato dello specchio. Le luci restano
// presenti: stesso numero di luci e stessi shader nel pass principale e riflesso.
export function createReflectionSubstitute({ room, door, substitute }) {
  return (render) => {
    const hidden = [door, ...room.children.filter((o) => !o.isLight)];
    const visibility = hidden.map((o) => o.visible), previous = substitute.visible;
    hidden.forEach((o) => { o.visible = false; });
    substitute.visible = true;
    try { return render(); }
    finally {
      hidden.forEach((o, i) => { o.visible = visibility[i]; });
      substitute.visible = previous;
    }
  };
}
