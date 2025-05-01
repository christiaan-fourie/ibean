import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";


const Sales = () => {

    return (
      <div className="flex p-4 bg-neutral-900 text-neutral-50"> 

        <div> 
          <Products />
        </div> 

        <OrderCheckout />       

      </div>
    )
  }
  
  export default Sales