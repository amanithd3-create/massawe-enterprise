import React,{useEffect,useMemo,useState} from "react";import{createRoot}from"react-dom/client";import{ShoppingBag,LayoutDashboard,Package,Users,ClipboardList,Percent,ChartNoAxesCombined,Settings,Store,Menu,Search,Plus,LogOut,Trash2,Edit,ArrowUpRight,ShoppingCart,Boxes,Wallet,Globe,Plug,Tag,RefreshCw,ChevronRight,X,CheckCircle,AlertCircle,Heart}from"lucide-react";import"./style.css";
const SUPABASE_FUNCTIONS = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
import { supabase } from "./supabase.js";
const API=import.meta.env.VITE_API_URL||"";
const money=n=>new Intl.NumberFormat("en-TZ",{style:"currency",currency:"TZS",maximumFractionDigits:0}).format(n||0);
function App(){const[token,setToken]=useState(localStorage.getItem("me_token")||"");const[user,setUser]=useState(JSON.parse(localStorage.getItem("me_user")||"null"));const[page,setPage]=useState("Overview");const[mobile,setMobile]=useState(false);const[products,setProducts]=useState([]);const[orders,setOrders]=useState([]);const[dashboard,setDashboard]=useState({});const[customers,setCustomers]=useState([]);const[discounts,setDiscounts]=useState([]);const[businesses,setBusinesses]=useState([]);const[commissions,setCommissions]=useState([]);const[businessForm,setBusinessForm]=useState({name:"",category:"",description:"",email:"",phone:"",location:"",website:""});const[cart,setCart]=useState(JSON.parse(localStorage.getItem("me_cart")||"[]"));const[savedProducts,setSavedProducts]=useState(JSON.parse(localStorage.getItem("me_saved_products")||"[]"));const[showSaved,setShowSaved]=useState(false);const[query,setQuery]=useState("");const[categoryFilter,setCategoryFilter]=useState("All");const[modal,setModal]=useState("");const[editing,setEditing]=useState(null);const[busy,setBusy]=useState(false);const[notice,setNotice]=useState("");const[authMode,setAuthMode]=useState("login");const[showAuth,setShowAuth]=useState(false);const[authForm,setAuthForm]=useState({name:"",email:"",password:""});const[checkout,setCheckout]=useState({customerName:"",email:"",phone:"",address:"",city:"Moshi",country:"Tanzania"});const[form,setForm]=useState({});
const headers=()=>({"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})});
async function api(path,options={}){const r=await fetch(API+"/api"+path,{...options,headers:{...headers(),...(options.headers||{})}});const d=r.status===204?{}:await r.json();if(!r.ok)throw Error(d.error||"Request failed");return d}
function flash(s){setNotice(s);setTimeout(()=>setNotice(""),3500)}
async function load() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setProducts((data || []).map(p => ({
      ...p,
      price: p.price_tzs,
      stock: p.inventory_quantity,
      active: p.status === "active",
      category: p.category || p.product_type || "",
      imageUrl: p.image_url || ""
    })));

    if (token) {
      try {
        const {data: businessRows,error: businessError}=await supabase.from("businesses").select("*").order("created_at",{ascending:false});
        if(businessError) throw businessError;
        setBusinesses(businessRows||[]);
        const {data: commissionRows,error: commissionError}=await supabase.from("order_commissions").select("*, businesses(name)").order("created_at",{ascending:false});
        if(!commissionError) setCommissions(commissionRows||[]);
        const [o,d,c,ds] = await Promise.all([
          api("/orders"),
          api("/admin/dashboard"),
          api("/admin/customers"),
          api("/admin/discounts")
        ]);

        setOrders(o.orders || []);
        setDashboard(d || {});
        setCustomers(c.customers || []);
        setDiscounts(ds.discounts || []);
      } catch (error) {
        console.warn("Other dashboard services:", error.message);
      }
    }
  } catch (error) {
    flash(error.message);
  }
}
               
useEffect(()=>{load()},[token]);
function logout(){setToken("");setUser(null);localStorage.removeItem("me_token");localStorage.removeItem("me_user");setPage("Overview")}
async function submitAuth(e){
  e.preventDefault();
  setBusy(true);

  try {
    if(authMode==="register"){
      const {data,error}=await supabase.auth.signUp({
        email:authForm.email,
        password:authForm.password,
        options:{
          data:{name:authForm.name}
        }
      });

      if(error) throw error;

      if(!data.session){
        flash("Account created! Check your email to verify it.");
        setAuthMode("login");
        return;
      }
    } else {
      const {error}=await supabase.auth.signInWithPassword({
        email:authForm.email,
        password:authForm.password
      });

      if(error) throw error;
    }

    const {data:{session}}=await supabase.auth.getSession();

    if(session){
      setToken(session.access_token);
      setUser({
        id:session.user.id,
        email:session.user.email,
        name:session.user.user_metadata?.name || "Customer",
        role:(await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle()).data?.role || "customer"
      });
      flash("Welcome to Massawe Enterprise!");
    }

  } catch(error){
    flash(error.message);
  } finally {
    setBusy(false);
  }
        }
function toggleSaved(id){const next=savedProducts.includes(id)?savedProducts.filter(x=>x!==id):[...savedProducts,id];setSavedProducts(next);localStorage.setItem("me_saved_products",JSON.stringify(next));flash(savedProducts.includes(id)?"Removed from saved items":"Saved for later")}\nfunction addCart(p){const next=[...cart];const found=next.find(x=>x.productId===p.id);if(found)found.quantity++;else next.push({productId:p.id,title:p.title,price:p.price,quantity:1});setCart(next);localStorage.setItem("me_cart",JSON.stringify(next));flash("Added to cart")}
async function placeOrder(e){e.preventDefault();setBusy(true);try{const d=await api("/orders",{method:"POST",body:JSON.stringify({...checkout,items:cart.map(x=>({productId:x.productId,quantity:x.quantity}))})});flash(d.error||"Order saved. Payment is not configured yet.");if(d.orderNumber)flash(`Order ${d.orderNumber} saved. ${d.error||"Awaiting payment setup."}`);setCart([]);localStorage.removeItem("me_cart");setModal("");load()}catch(e){flash(e.message)}finally{setBusy(false)}}
function openProduct(p=null){setEditing(p);setForm(p?{...p}:{title:"",slug:"",description:"",sku:"",price:0,stock:0,active:true,imageUrl:"",category:"",business_id:""});setModal("product")}
async function saveProduct(e) {
  e.preventDefault();
  setBusy(true);

  try {
    const payload = {
      title: form.title,
      slug: form.slug || form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-"),
      business_id: form.business_id || null,
      description: form.description || null,
      sku: form.sku || null,
      product_type: form.category || null,
      category: form.category || null,
      image_url: form.imageUrl || null,
      price_tzs: Number(form.price),
      inventory_quantity: Number(form.stock),
      status: form.active ? "active" : "draft"
    };

    const result = editing
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id)
          .select()
      : await supabase
          .from("products")
          .insert(payload)
          .select();

    if (result.error) throw result.error;

    flash("Product saved successfully!");
    setModal("");
    setEditing(null);
    await load();

  } catch (error) {
    flash(error.message);
  } finally {
    setBusy(false);
  }
}
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  try {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    flash("Product deleted successfully!");
    await load();

  } catch (error) {
    flash(error.message);
  }
}
async function updateOrder(id,status){try{await api("/orders/"+id+"/status",{method:"PATCH",body:JSON.stringify({status})});flash("Order updated");load()}catch(e){flash(e.message)}}
async function createDiscount(e){e.preventDefault();try{await api("/admin/discounts",{method:"POST",body:JSON.stringify({code:form.code,percentOff:Number(form.percentOff)})});flash("Discount created");setModal("");load()}catch(e){flash(e.message)}}
async function registerBusiness(e){e.preventDefault();setBusy(true);try{const {error}=await supabase.from("businesses").insert({...businessForm,owner_id:user.id,status:"pending"});if(error)throw error;setBusinessForm({name:"",category:"",description:"",email:"",phone:"",location:"",website:""});flash("Business submitted for approval.");await load()}catch(error){flash(error.message)}finally{setBusy(false)}}
async function setBusinessStatus(id,status){try{const {error}=await supabase.from("businesses").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error;flash("Business status updated.");await load()}catch(error){flash(error.message)}}
const nav=[["Overview",LayoutDashboard],["Businesses",Store],["My Business",Users],["Orders",ClipboardList],["Products",Package],["Customers",Users],["Discounts",Percent],["Analytics",ChartNoAxesCombined],["Marketing",Globe],["Markets",Store],["Finance",Wallet],["Apps",Plug],["Online Store",ShoppingBag],["Point of Sale",Boxes],["Settings",Settings]];
const categories=[...new Set(products.filter(p=>p.active).map(p=>p.category).filter(Boolean))];
const filtered=products.filter(p=>(p.title+" "+(p.sku||"")+" "+(p.category||"")).toLowerCase().includes(query.toLowerCase())&&(categoryFilter==="All"||p.category===categoryFilter));
if(!token)return <div className="marketplace">
<header className="market-header"><div className="market-brand"><span className="logo">M</span><span><b>MASSAWE</b><small>ENTERPRISE MARKETPLACE</small></span></div><div className="market-actions"><button className="outline market-cart" onClick={()=>document.getElementById("market-products")?.scrollIntoView({behavior:"smooth"})}><ShoppingCart size={15}/> Cart ({cart.reduce((n,x)=>n+x.quantity,0)})</button><button className="outline" onClick={()=>{setAuthMode("login");setShowAuth(true)}}>Log in</button><button className="primary" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Join Massawe</button></div></header>
<section className="market-hero"><div className="hero-copy"><span className="hero-kicker">TANZANIA'S GROWING MARKETPLACE</span><h1>Good finds. Great businesses. All in one place.</h1><p>Discover products from local businesses, compare your options and connect directly with sellers across Tanzania.</p><div className="hero-buttons"><button className="primary" onClick={()=>document.getElementById("market-products")?.scrollIntoView({behavior:"smooth"})}>Explore products <ArrowUpRight size={16}/></button><button className="outline" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Start selling</button></div><div className="hero-trust"><span>✓ Local businesses</span><span>✓ Easy discovery</span><span>✓ Seller connections</span></div></div><div className="hero-art"><div className="hero-orbit orbit-one"></div><div className="hero-orbit orbit-two"></div><div className="hero-shopping"><ShoppingBag size={68}/></div><div className="hero-float float-top">✨ Discover something new</div><div className="hero-float float-bottom">🌿 Support local sellers</div></div></section>
<section className="market-promo"><div><span className="promo-tag">BUSINESS PROMOTION</span><h2>Put your business in front of more customers.</h2><p>Create your seller profile and showcase your products on Massawe Enterprise.</p></div><button className="primary" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Promote my business <ArrowUpRight size={16}/></button></section>
<section className="market-benefits"><div><span>🔎</span><b>Discover with ease</b><small>Search products and explore categories</small></div><div><span>🤝</span><b>Meet local sellers</b><small>Connect with businesses directly</small></div><div><span>📈</span><b>Grow your reach</b><small>Give your business a digital shopfront</small></div></section>
<section className="success-stage"><div className="success-stage-copy"><span className="success-eyebrow">BIG IDEAS START SOMEWHERE</span><h2>Your next chapter could be your biggest one.</h2><p>Turn the products you make, sell or love into new opportunities. Build your brand, meet customers and grow at your own pace.</p><button className="success-cta" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Start your success story <ArrowUpRight size={16}/></button></div><div className="success-stage-art"><div className="success-sun"></div><div className="success-card success-card-one">💡 <b>Big ideas</b><small>Start with one product</small></div><div className="success-card success-card-two">🚀 <b>More reach</b><small>Meet new customers</small></div><div className="success-card success-card-three">🌟 <b>New possibilities</b><small>Grow step by step</small></div></div></section>
<section className="color-campaigns"><div className="campaign-heading"><span>EXPLORE WHAT'S POSSIBLE</span><h2>More than a shop. A place to grow.</h2><p>Discover opportunities for shoppers, creators and ambitious businesses.</p></div><div className="campaign-grid"><article className="campaign-card campaign-purple"><span className="campaign-icon">🛍️</span><small>FOR SHOPPERS</small><h3>Find your next favourite.</h3><p>Explore products and discover businesses worth knowing.</p><button onClick={()=>document.getElementById("market-products")?.scrollIntoView({behavior:"smooth"})}>Explore marketplace <ArrowUpRight size={15}/></button></article><article className="campaign-card campaign-orange"><span className="campaign-icon">🎨</span><small>FOR ENTREPRENEURS</small><h3>Give your idea a storefront.</h3><p>Showcase your products and introduce your brand to new people.</p><button onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Create your business <ArrowUpRight size={15}/></button></article><article className="campaign-card campaign-blue"><span className="campaign-icon">🤝</span><small>FOR BUSINESS NETWORKS</small><h3>Connections create opportunity.</h3><p>Meet other businesses and build valuable relationships.</p><button onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Join the community <ArrowUpRight size={15}/></button></article></div></section>
<section className="market-products" id="market-products"><div className="market-section-head"><div><span className="hero-kicker">THE MARKETPLACE</span><h2>Find products</h2></div><div className="market-search"><Search/><input placeholder="Search products, brands or categories..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="market-tools"><div className="category-chips"><button className={categoryFilter==="All"?"active":""} onClick={()=>setCategoryFilter("All")}>All products</button>{categories.map(c=><button key={c} className={categoryFilter===c?"active":""} onClick={()=>setCategoryFilter(c)}>{c}</button>)}</div><button className={`saved-toggle ${showSaved?"active":""}`} onClick={()=>setShowSaved(!showSaved)}><Heart size={14}/> {showSaved?"Show all products":`Saved items (${savedProducts.length})`}</button></div>{cart.length>0&&<div className="cart-summary"><div><b><ShoppingCart size={16}/> Your cart</b><small>{cart.reduce((n,x)=>n+x.quantity,0)} item(s) saved in this browser</small></div><strong>{money(cart.reduce((n,x)=>n+x.price*x.quantity,0))}</strong><button className="outline" onClick={()=>{setCart([]);localStorage.removeItem("me_cart");flash("Cart cleared")}}>Clear cart</button></div>}<div className="market-grid">{filtered.filter(p=>p.active&&(!showSaved||savedProducts.includes(p.id))).map(p=><article className="market-product" key={p.id}><div className="market-product-image">{p.imageUrl?<img src={p.imageUrl} alt={p.title}/>:<Package size={42}/>}<button className={`save-product ${savedProducts.includes(p.id)?"saved":""}`} aria-label="Save product" onClick={()=>toggleSaved(p.id)}><Heart size={17} fill={savedProducts.includes(p.id)?"currentColor":"none"}/></button></div><div className="market-product-info"><small>{p.category||"Marketplace product"}</small><h3>{p.title}</h3><p>{p.description||"Contact the seller to learn more."}</p><div><b>{money(p.price)}</b><button className="primary" onClick={()=>addCart(p)}><ShoppingCart size={14}/> Add to cart</button></div></div></article>)}</div>{!filtered.filter(p=>p.active).length&&<div className="market-empty"><div className="empty-market-icon"><Search size={28}/></div><h3>{showSaved?"No saved products yet":products.some(p=>p.active)?"No matching products":"Be among the first to discover local products"}</h3><p>{products.some(p=>p.active)?"Try another search or category.":"Businesses can create a free profile and add their real products. New listings will appear here automatically."}</p><button className="primary" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Open a seller account <ArrowUpRight size={15}/></button></div>}</section>
<section className="market-join"><div><span className="hero-kicker">YOUR NEXT CUSTOMER IS OUT THERE</span><h2>Ready to grow your business?</h2><p>Join the marketplace, create your business profile and start showing customers what you offer.</p></div><button className="primary" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Join as a business <ArrowUpRight size={16}/></button></section><footer className="market-footer"><div><b>MASSAWE ENTERPRISE</b><small>Discover. Connect. Grow.</small></div><div><button className="text-button" onClick={()=>{setAuthMode("login");setShowAuth(true)}}>Log in</button><button className="text-button" onClick={()=>{setAuthMode("register");setShowAuth(true)}}>Create account</button></div></footer>
{showAuth&&<div className="modal-shade" onMouseDown={e=>e.target===e.currentTarget&&setShowAuth(false)}><section className="auth-card auth-modal"><button className="auth-close" onClick={()=>setShowAuth(false)}><X/></button><div className="logo large">M</div><p className="overline">MASSAWE ENTERPRISE</p><h1>{authMode==="login"?"Welcome back":"Create your account"}</h1><p className="muted">{authMode==="login"?"Sign in to your account.":"Join the marketplace to shop or grow your business."}</p><form onSubmit={submitAuth}>{authMode==="register"&&<input placeholder="Your full name" required value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})}/>}<input type="email" placeholder="Email address" required value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/><input type="password" placeholder="Password (10+ characters)" minLength="10" required value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/><button className="primary full" disabled={busy}>{busy?"Please wait…":authMode==="login"?"Sign in":"Create account"}</button></form><button className="link" onClick={()=>setAuthMode(authMode==="login"?"register":"login")}>{authMode==="login"?"New here? Create an account":"Already have an account? Sign in"}</button></section></div>}
{notice&&<div className="toast">{notice}</div>}</div>;
return <div className="layout"><aside className={`sidebar ${mobile?"open":""}`}><div className="brand"><div className="logo">M</div><div><b>MASSAWE</b><small>ENTEPRICE</small></div><button className="close-mobile" onClick={()=>setMobile(false)}><X/></button></div><div className="store-chip"><div className="avatar">ME</div><div><b>Massawe Enteprice</b><small>Commerce admin</small></div></div><div className="nav-label">WORKSPACE</div>{nav.map(([n,Icon])=><button key={n} className={`nav ${page===n?"selected":""}`} onClick={()=>{setPage(n);setMobile(false)}}><Icon size={17}/>{n}{n==="Orders"&&orders.length>0&&<span className="count">{orders.length}</span>}</button>)}<div className="side-bottom"><div className="avatar">{user?.name?.[0]||"A"}</div><div className="user-name"><b>{user?.name}</b><small>{user?.role}</small></div><button className="icon-button" onClick={logout} title="Sign out"><LogOut size={16}/></button></div></aside>
<main className="main"><header className="topbar"><button className="icon-button mobile-only" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs">Store <span>/</span> <b>{page}</b></div><div className="top-right"><button className="outline" onClick={()=>setPage("Online Store")}>View store <ArrowUpRight size={14}/></button><div className="avatar">ME</div></div></header>
<div className="content"><div className="page-head"><div><div className="overline">STORE MANAGEMENT</div><h1>{page==="Overview"?"Good morning, "+(user?.name||"Admin"):page}</h1><p className="muted">{({Overview:"Here's what's happening with your store.",Businesses:"Review and approve marketplace businesses.", "My Business":"Register and manage your business profile.",Products:"Manage your catalogue, pricing and inventory.",Orders:"Review orders and manage fulfilment.",Customers:"Your customer accounts and relationships.",Discounts:"Create promotional discount codes.",Analytics:"Review sales and business performance.",Settings:"Store configuration and account settings."})[page]||"Manage this part of your business."}</p></div><div className="actions">{page==="Products"&&<button className="primary" onClick={()=>openProduct()}>＋ Add product</button>}{page==="Discounts"&&<button className="primary" onClick={()=>{setForm({});setModal("discount")}}>＋ Create discount</button>}</div></div>
{page==="Overview"&&<><div className="stats">{[[ "Total sales",money(dashboard.revenue),"TZS settled payments",Wallet],[ "Orders",dashboard.orders??orders.length,"Recorded orders",ClipboardList],[ "Products",dashboard.products??products.length,"Catalogue items",Package],[ "Customers",dashboard.customers??customers.length,"Customer accounts",Users]].map(([a,b,c,I])=><div className="panel stat" key={a}><div className="stat-top">{a}<I size={18}/></div><h2>{b??"—"}</h2><small>{c}</small></div>)}</div><div className="columns"><section className="panel"><div className="panel-title"><div><h3>Recent orders</h3><p>Latest customer activity</p></div><button className="text-button" onClick={()=>setPage("Orders")}>View all →</button></div><OrderTable orders={orders.slice(0,6)} updateOrder={updateOrder}/></section><section className="panel"><div className="panel-title"><div><h3>Store checklist</h3><p>Prepare your business to sell online</p></div></div>{["Add products","Set delivery rates","Connect payment provider","Publish store policies","Set up custom domain"].map((x,i)=><div className="check-row" key={x}><span className="check-icon">{i===0&&products.length?"✓":i+1}</span><div><b>{x}</b><small>{i===0&&products.length?"Products added":"Setup required"}</small></div></div>)}</section></div></>}
{page==="Businesses"&&<div className="panel table-wrap"><h3 style={{padding:"16px"}}>Business applications</h3><table><thead><tr><th>BUSINESS</th><th>OWNER</th><th>CONTACT</th><th>LOCATION</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>{businesses.map(b=><tr key={b.id}><td><b>{b.name}</b></td><td>{b.owner_id}</td><td>{b.email||"—"} / {b.phone||"—"}</td><td>{b.location||"—"}</td><td>{b.status}</td><td><button className="primary" onClick={()=>setBusinessStatus(b.id,"approved")}>Approve</button><button className="outline" onClick={()=>setBusinessStatus(b.id,"suspended")}>Suspend</button></td></tr>)}</tbody></table>{!businesses.length&&<Empty title="No businesses yet" text="New business applications will appear here."/>}</div>}
{page==="My Business"&&<><section className="panel" style={{padding:18,marginBottom:16}}><div className="panel-title"><div><h3>Register your business</h3><p>Applications are reviewed before products can be listed.</p></div></div><form className="form" style={{padding:18}} onSubmit={registerBusiness}><Field label="Business name"><input required value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></Field><Field label="Category"><input value={businessForm.category} onChange={e=>setBusinessForm({...businessForm,category:e.target.value})}/></Field><Field label="Business email"><input type="email" value={businessForm.email} onChange={e=>setBusinessForm({...businessForm,email:e.target.value})}/></Field><Field label="Phone number"><input value={businessForm.phone} onChange={e=>setBusinessForm({...businessForm,phone:e.target.value})}/></Field><Field label="Location"><input value={businessForm.location} onChange={e=>setBusinessForm({...businessForm,location:e.target.value})}/></Field><Field label="Website"><input value={businessForm.website} onChange={e=>setBusinessForm({...businessForm,website:e.target.value})}/></Field><Field label="Description" full><textarea value={businessForm.description} onChange={e=>setBusinessForm({...businessForm,description:e.target.value})}/></Field><div className="modal-actions"><button className="primary" disabled={busy}>{busy?"Submitting…":"Submit business"}</button></div></form></section><section className="panel table-wrap"><div className="panel-title"><div><h3>Your business applications</h3><p>Approved businesses can start listing products.</p></div></div><table><thead><tr><th>BUSINESS</th><th>CATEGORY</th><th>STATUS</th><th>SUBMITTED</th></tr></thead><tbody>{businesses.filter(b=>b.owner_id===user?.id).map(b=><tr key={b.id}><td><b>{b.name}</b></td><td>{b.category||"—"}</td><td><span className={`pill ${b.status==="approved"?"green":"orange"}`}>{b.status}</span></td><td>{new Date(b.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></section></>}
{page==="Finance"&&<div className="panel table-wrap"><h3 style={{padding:"16px"}}>5% commission ledger</h3><table><thead><tr><th>BUSINESS</th><th>ORDER</th><th>SALE</th><th>RATE</th><th>COMMISSION</th><th>STATUS</th></tr></thead><tbody>{commissions.map(c=><tr key={c.id}><td>{c.businesses?.name||c.business_id}</td><td>{c.order_id}</td><td>{money(c.sale_amount)}</td><td>{c.commission_rate}%</td><td>{money(c.commission_amount)}</td><td>{c.status}</td></tr>)}</tbody></table>{!commissions.length&&<Empty title="No commissions yet" text="Records appear after an approved business product is paid for."/>}</div>}
{page==="Products"&&<><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Search products" value={query} onChange={e=>setQuery(e.target.value)}/></div><span>{filtered.length} products</span></div><div className="panel table-wrap"><table><thead><tr><th>PRODUCT</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div className="product-cell"><div className="product-img">{p.imageUrl?<img src={p.imageUrl}/>:<Package/>}</div><div><b>{p.title}</b><small>{p.sku||p.slug}</small></div></div></td><td>{money(p.price)}</td><td>{p.stock}</td><td><span className={`pill ${p.active?"green":"gray"}`}>{p.active?"Active":"Draft"}</span></td><td><button className="icon-button" onClick={()=>openProduct(p)}><Edit size={15}/></button><button className="icon-button danger" onClick={()=>deleteProduct(p.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!filtered.length&&<Empty title="No products found" text="Add a product to start building your catalogue."/>}</div></>}
{page==="Orders"&&<div className="panel table-wrap"><OrderTable orders={orders} updateOrder={updateOrder}/></div>}
{page==="Customers"&&<div className="panel table-wrap"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>JOINED</th><th>ORDERS</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td>{c.email}</td><td>{c.phone||"—"}</td><td>{new Date(c.createdAt).toLocaleDateString()}</td><td>{c._count.orders}</td></tr>)}</tbody></table></div>}
{page==="Discounts"&&<div className="panel table-wrap"><table><thead><tr><th>CODE</th><th>DISCOUNT</th><th>USES</th><th>STATUS</th><th></th></tr></thead><tbody>{discounts.map(d=><tr key={d.id}><td><b>{d.code}</b></td><td>{d.percentOff?d.percentOff+"%":money(d.amountOff)}</td><td>{d.usedCount}</td><td><span className="pill green">{d.active?"Active":"Inactive"}</span></td><td>{d.expiresAt?new Date(d.expiresAt).toLocaleDateString():"No expiry"}</td></tr>)}</tbody></table></div>}
{page==="Analytics"&&<div className="stats">{[[ "Revenue",money(dashboard.revenue)],[ "Orders",dashboard.orders],[ "Products",dashboard.products],[ "Customers",dashboard.customers]].map(([k,v])=><div className="panel stat" key={k}><small>{k}</small><h2>{v??"—"}</h2></div>)}</div>}
{!["Overview","Products","Orders","Customers","Discounts","Analytics"].includes(page)&&<div className="panel setup-panel"><div className="setup-icon"><Settings size={26}/></div><h2>{page} configuration</h2><p>This module is reserved in the platform navigation. Connect the relevant provider or configure the business workflow before enabling it for live operations.</p><div className="notice"><AlertCircle size={17}/> Payment processing, shipping, marketing campaigns and POS require provider credentials and integration work.</div></div>}
</div></main>
{notice&&<div className="toast">{notice}</div>}
{modal&&<div className="modal-shade" onMouseDown={e=>e.target===e.currentTarget&&setModal("")}><section className="modal"><div className="modal-head"><div><h2>{modal==="product"?(editing?"Edit product":"Add product"):"Create discount"}</h2><p>Enter accurate information for your store.</p></div><button className="icon-button" onClick={()=>setModal("")}><X/></button></div>{modal==="product"?<form onSubmit={saveProduct} className="form"><Field label="Product title"><input required value={form.title||""} onChange={e=>setForm({...form,title:e.target.value,slug:form.slug||e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-")})}/></Field><Field label="URL slug"><input required value={form.slug||""} onChange={e=>setForm({...form,slug:e.target.value})}/></Field><Field label="Price (TZS)"><input type="number" min="0" required value={form.price??0} onChange={e=>setForm({...form,price:e.target.value})}/></Field><Field label="Stock quantity"><input type="number" min="0" required value={form.stock??0} onChange={e=>setForm({...form,stock:e.target.value})}/></Field><Field label="SKU"><input value={form.sku||""} onChange={e=>setForm({...form,sku:e.target.value})}/></Field><Field label="Category"><input value={form.category||""} onChange={e=>setForm({...form,category:e.target.value})}/></Field><Field label="Business"><select value={form.business_id||""} onChange={e=>setForm({...form,business_id:e.target.value})}><option value="">Massawe Enterprise</option>{businesses.filter(b=>b.owner_id===user?.id&&b.status==="approved").map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Image URL"><input type="url" value={form.imageUrl||""} onChange={e=>setForm({...form,imageUrl:e.target.value})}/></Field><Field label="Status"><select value={form.active?"true":"false"} onChange={e=>setForm({...form,active:e.target.value==="true"})}><option value="true">Active</option><option value="false">Draft</option></select></Field><Field label="Description" full><textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="outline" onClick={()=>setModal("")}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving…":"Save product"}</button></div></form>:<form onSubmit={createDiscount} className="form"><Field label="Discount code"><input required value={form.code||""} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></Field><Field label="Percentage off"><input type="number" min="1" max="100" required value={form.percentOff||""} onChange={e=>setForm({...form,percentOff:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="outline" onClick={()=>setModal("")}>Cancel</button><button className="primary">Create discount</button></div></form>}</section></div>}
</div>}
function Field({label,children,full}){return <label className={`field ${full?"full":""}`}><span>{label}</span>{children}</label>}
function Empty({title,text}){return <div className="empty"><b>{title}</b><p>{text}</p></div>}
function OrderTable({orders,updateOrder}){return <table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>TOTAL</th><th>PAYMENT</th><th>ORDER STATUS</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b>{o.orderNumber}</b></td><td>{o.customerName}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td><td>{money(o.total)}</td><td><span className={`pill ${o.paymentStatus==="PAID"?"green":"orange"}`}>{o.paymentStatus}</span></td><td><select className="status-select" value={o.status} onChange={e=>updateOrder(o.id,e.target.value)}>{["PENDING","PAID","PROCESSING","FULFILLED","CANCELLED","REFUNDED"].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>}
createRoot(document.getElementById("root")).render(<App/>);
