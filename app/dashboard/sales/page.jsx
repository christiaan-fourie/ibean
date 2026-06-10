import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";

const Sales = () => {
  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-rows-[minmax(0,1fr)_minmax(220px,38vh)] gap-2 bg-neutral-900/40 p-2 text-neutral-50 md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 shadow-sm backdrop-blur-xl">
        <Products />
      </section>
      <section className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70 shadow-sm backdrop-blur-xl">
        <OrderCheckout />
      </section>
    </div>
  );
};

export default Sales;
