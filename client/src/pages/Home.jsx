import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Cpu,
  Box,
  Cable,
  Headphones,
  Gamepad2,
  Smartphone,
  Layers3,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { ErrorBox, Loading, ProductGrid } from "../components/UI";
const icons = [Cpu, Cable, Headphones, Gamepad2, Smartphone, Box];
export default function Home() {
  const products = useApi("/products?featured=true");
  const categories = useApi("/categories");
  const roots = categories.data?.filter((c) => !c.parent_id).slice(0, 6) || [];
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> TU PRÓXIMO HALLAZGO ESTÁ ACÁ
          </span>
          <h1>
            Tecnología.
            <br />
            Ideas.{" "}
            <span>
              Y mucho
              <br className="desktop-break" /> más.
            </span>
          </h1>
          <p>
            Accesorios que te simplifican el día e impresiones 3D que hacen
            realidad lo que imaginás.
          </p>
          <div className="hero-buttons">
            <Link className="button primary" to="/productos">
              Explorar productos <ArrowUpRight size={19} />
            </Link>
            <Link className="text-link" to="/impresiones-3d">
              Descubrí el mundo 3D <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-note">
            <span>MINORISTA</span>
            <span>MAYORISTA</span>
            <span>HECHO A TU MEDIDA</span>
          </div>
        </div>
        <div className="hero-art" aria-label="Tecnología e impresión 3D">
          <div className="art-grid" />
          <span className="art-label">OBJETOS QUE CONECTAN.</span>
          <div className="headphone">
            <div className="headband" />
            <div className="ear ear-left" />
            <div className="ear ear-right" />
          </div>
          <div className="art-caption">
            <span className="small-orbit" />
            Conectá con lo que te gusta.
          </div>
          <div className="print-card">
            <span className="eyebrow">DE LA IDEA AL OBJETO</span>
            <div className="printed-object">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
            <strong>
              Imaginá.
              <br />
              Nosotros lo creamos.
            </strong>
            <Link
              to="/impresiones-3d"
              className="round-link"
              aria-label="Explorar impresiones 3D"
            >
              <ArrowUpRight />
            </Link>
          </div>
          <span className="art-index">01 / INFINITAS POSIBILIDADES</span>
        </div>
      </section>
      <section className="category-section wrap">
        <div className="section-heading">
          <div>
            <span className="eyebrow blue">ENCONTRÁ LO QUE VA CON VOS</span>
            <h2>Un mundo de posibilidades.</h2>
          </div>
          <Link className="text-link" to="/categorias">
            Todas las categorías <ArrowRight size={17} />
          </Link>
        </div>
        <ErrorBox message={categories.error} />
        {categories.loading ? (
          <Loading />
        ) : roots.length ? (
          <div className="category-grid">
            {roots.map((c, i) => {
              const Icon = icons[i % icons.length];
              return (
                <Link
                  to={`/productos?category_id=${c.id}`}
                  className="category-tile"
                  key={c.id}
                >
                  <Icon size={29} />
                  <span>{c.name}</span>
                  <ArrowUpRight size={17} />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="category-intro">
            <Cpu size={34} />
            <p>
              Tecnología, accesorios y objetos únicos.
              <br />
              <span>
                Pronto encontrarás aquí las categorías de nuestro catálogo.
              </span>
            </p>
            <Link to="/impresiones-3d">
              Conocé nuestras impresiones 3D <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </section>
      <section className="featured-section wrap">
        <div className="section-heading">
          <div>
            <span className="eyebrow blue">SELECCIONADOS PARA VOS</span>
            <h2>Encontrá tu próximo favorito.</h2>
          </div>
          <Link className="text-link" to="/productos">
            Ver todos los productos <ArrowRight size={17} />
          </Link>
        </div>
        <ErrorBox message={products.error} />
        {products.loading ? (
          <Loading />
        ) : (
          products.data && <ProductGrid products={products.data.slice(0, 8)} />
        )}
      </section>
      <section className="three-banner wrap">
        <div className="three-visual">
          <Layers3 size={110} strokeWidth={0.7} />
          <span>
            IDEAS EN
            <br />
            OTRA DIMENSIÓN.
          </span>
        </div>
        <div>
          <span className="eyebrow">ESTUDIO DE IMPRESIÓN 3D</span>
          <h2>
            Si lo imaginás,
            <br />
            puede tomar forma.
          </h2>
          <p>
            Descubrí diseños listos para vos o contanos tu idea. Creamos objetos
            funcionales, regalos y piezas con tu identidad.
          </p>
          <div className="hero-buttons">
            <Link className="button light" to="/productos?type=IMPRESION_3D">
              Ver diseños <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/impresiones-3d#personalizado">
              Tengo una idea <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section id="negocio" className="about wrap">
        <div>
          <span className="eyebrow blue">SOMOS NOVEDADES DOBLE A</span>
          <h2>
            Tu local de siempre.
            <br />
            Con nuevas posibilidades.
          </h2>
        </div>
        <div>
          <p>
            Un lugar para encontrar tecnología, accesorios y productos que hacen
            más práctico tu día a día. Con la atención cercana de un comercio y
            la comodidad de comprar online.
          </p>
          <div className="about-options">
            <div>
              <strong>Para vos</strong>
              <span>Elegí lo que necesitás, por unidad.</span>
            </div>
            <div>
              <strong>Para tu negocio</strong>
              <span>
                Dejanos tu consulta mayorista en las observaciones de una
                solicitud.
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
