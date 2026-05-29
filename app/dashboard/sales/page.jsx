import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";


const Sales = () => {

  return (
    <div className="flex h-full bg-neutral-900 text-neutral-50">

      <div className="flex-1 flex overflow-auto">
        <Products />
        <OrderCheckout />
      </div>



    </div>
  )
}

export default Sales