import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";


const Sales = () => {

    return (
      <div className="flex min-h-screen p-4 bg-neutral-900 text-neutral-50"> 

        <div className="w-3/4 flex"> 
          <Products />
        </div> 

        <OrderCheckout />       

      </div>
    )
  }
  
  export default Sales