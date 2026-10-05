import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowUpRight, Folder } from "lucide-react";
import { useApi } from "../hooks/useApi";
import {
  Empty,
  ErrorBox,
  Loading,
  PageHeading,
  ProductGrid,
} from "../components/UI";
export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const categories = useApi("/categories");
  const products = useApi(`/products?${params}`);
  function filter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "category_id") next.delete("subcategory_id");
    setParams(next, { replace: true });
  }
  return (
    <div className="wrap page">
      <PageHeading
        eyebrow="EL CATÁLOGO DOBLE A"
        title="Encontrá eso que buscás."
        description="Tecnología, accesorios y objetos para tu día a día."
      />
      <div className="catalog-layout">
        <aside className="filters">
          <h3>
            <SlidersHorizontal size={18} /> Filtrar productos
          </h3>
          <label>
            Buscar
            <div className="input-icon">
              <Search size={17} />
              <input
                value={params.get("search") || ""}
                onChange={(e) => filter("search", e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>
          </label>
          <label>
            Categoría
            <select
              value={params.get("category_id") || ""}
              onChange={(e) => filter("category_id", e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.data
                ?.filter((c) => !c.parent_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Subcategoría
            <select
              value={params.get("subcategory_id") || ""}
              onChange={(e) => filter("subcategory_id", e.target.value)}
              disabled={!params.get("category_id")}
            >
              <option value="">Todas las subcategorías</option>
              {categories.data
                ?.filter(
                  (c) => String(c.parent_id) === params.get("category_id"),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              value={params.get("type") || ""}
              onChange={(e) => filter("type", e.target.value)}
            >
              <option value="">Todos los productos</option>
              <option value="PRODUCTO">Tecnología y artículos</option>
              <option value="IMPRESION_3D">Impresión 3D</option>
              <option value="PERSONALIZADO">Personalizados</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={params.get("available") === "true"}
              onChange={(e) =>
                filter("available", e.target.checked ? "true" : "")
              }
            />{" "}
            Solo con stock
          </label>
          <button className="text-link" onClick={() => setParams({})}>
            Limpiar filtros
          </button>
          <ErrorBox message={categories.error} />
        </aside>
        <section>
          <div className="catalog-toolbar">
            <span>{products.data?.length ?? "…"} productos</span>
            <label>
              Ordenar por
              <select
                value={params.get("sort") || "recent"}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="name">Nombre A–Z</option>
              </select>
            </label>
          </div>
          <ErrorBox message={products.error} />
          {products.loading ? (
            <Loading />
          ) : products.data?.length ? (
            <ProductGrid products={products.data} />
          ) : (
            !products.error && (
              <Empty
                title="No encontramos productos"
                description="Probá con otra búsqueda o volvé pronto para ver las novedades."
              />
            )
          )}
        </section>
      </div>
    </div>
  );
}
export function Categories() {
  const { data, loading, error } = useApi("/categories");
  return (
    <div className="wrap page">
      <PageHeading
        eyebrow="EXPLORÁ LA TIENDA"
        title="Cada cosa, en su lugar."
        description="Elegí una categoría y descubrí todo lo que tenemos para vos."
      />
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="category-directory">
          {data
            .filter((c) => !c.parent_id)
            .map((c) => (
              <article className="panel" key={c.id}>
                <Folder className="blue" />
                <h2>
                  <Link to={`/productos?category_id=${c.id}`}>
                    {c.name} <ArrowUpRight size={20} />
                  </Link>
                </h2>
                {data
                  .filter((s) => s.parent_id === c.id)
                  .map((s) => (
                    <Link
                      key={s.id}
                      to={`/productos?category_id=${c.id}&subcategory_id=${s.id}`}
                    >
                      {s.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
              </article>
            ))}
        </div>
      ) : (
        <Empty title="Estamos organizando nuestras categorías" />
      )}
    </div>
  );
}
