import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";


const Sales = () => {

  return (
    <div className="flex h-full bg-neutral-900/40 text-neutral-50">

      <div className="flex-1 flex overflow-auto rounded-2xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl m-2">
        <Products />
        <OrderCheckout />
      </div>



    </div>
  )
}

export default Sales
