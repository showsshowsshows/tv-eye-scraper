"use client"
import { useRouter } from 'next/navigation'
import classes from './scraper.module.css'

function Scraper({ children }) {
    const router = useRouter()

    
    function handleClick() {
        router.refresh()
        router.push(`/?scraper=${true}`)    
    }

  return <button className={classes.btn} onClick={handleClick}>{children}</button> 
  
}

export default Scraper