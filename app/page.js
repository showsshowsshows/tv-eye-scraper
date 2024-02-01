import styles from './page.module.css';
import Scraper from './components/ui/scraper';
const fs = require('fs');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

let gigzArr = [];
const endpoint = 'https://tveyenyc.com/calendar/';

export default function Home({ searchParams }) {
  if (searchParams.scraper) {
    console.log('searchParams: ', searchParams);
    runProgram();
  }
  return (
    <main className={styles.main}>
      <Scraper>go</Scraper>
    </main>
  );
}

const runProgram = async () => {
  gigzArr = []; // Reset array
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Scraping data...')

  // Set browser viewport
  await page.setViewport({ width: 1300, height: 600 });

  // Go to URL
  await page.goto(endpoint, { waitUntil: 'domcontentloaded' });

  let loadMoreVisible = await isElementVisible(page, '.seetickets-list-view-load-more-button');
  while (loadMoreVisible) {
    await page.click('.seetickets-list-view-load-more-button');
    await new Promise(r => setTimeout(r, 3000)); // Adjust timeout as needed
    loadMoreVisible = await isElementVisible(page, '.seetickets-list-view-load-more-button');
  }

  // Scrape data after all content is loaded
  await scrapeData(page, browser);

  await browser.close(gigzArr.length);
  console.log('Browser closed');
  
  fs.writeFileSync('data.json', JSON.stringify(gigzArr, null, 2), 'utf-8');
  console.log('Data written to data.json');
  
  console.log(`finished scraping data. You have ${gigzArr.length} \n events saved in data.json`)
};

const scrapeData = async (page, browser) => {
  const content = await page.content();
  const $ = cheerio.load(content);

  const eventBlocks = $('.event-info-block').map((i, el) => {
    return {
      link: $(el).find('p.title a').attr('href'),
      title: $(el).find('p.title a').text(),
      dateString: $(el).find('p.date').text(),
      headliners: $(el).find('p.headliners').text(),
      doortime: $(el).find('span.see-doortime').text(),
      showtime: $(el).find('span.see-showtime').text(),
      venue: $(el).find('p.venue').text(),
      price: $(el).find('span.price').text(),
      genre: $(el).find('p.genre').text()
    };
  }).get();

  for (const event of eventBlocks) {
    const eventPage = await browser.newPage();
    await eventPage.goto(event.link, { waitUntil: 'domcontentloaded' });
    const eventContent = await eventPage.content();
    const $$ = cheerio.load(eventContent);

    let photoUrl = $$('#extra-data-container > div.event-images-box > div.main-image.m-b-5 > a > img').attr('src');
    let formattedDate = formatDateStringForMongoDB(event.dateString);
    let excerpt = $$('.event-details p').map((_, pElement) => $$(pElement).text()).get().join('\n');
    console.log("excerpt: " + excerpt);
    gigzArr.push({ 
      title: event.title, 
      date: formattedDate, 
      genre: event.genre,
      location: event.venue,
      time: event.showtime || "¯\\_(ツ)_/¯",
      price: event.price,
      isFeatured: false,
      image: photoUrl || "https://tveyenyc.com/wp-content/uploads/2023/01/tv-eye-e1673392710636.jpeg",
      excerpt: excerpt.trim(),
      rating: 0
    });

    await eventPage.close();
  }
};

const formatDateStringForMongoDB = (dateString) => {
  const currentYear = new Date().getFullYear(); 
  const date = new Date(`${dateString} ${currentYear}`);
  
  // Convert date to ISO string 
  let isoString = date.toISOString();

  let datePart = isoString.split('T')[0]; // Seperates date from time
  let timePart = '00:00:00.000';
  let timezoneOffset = '+00:00'; // Adjust if you need a different timezone

  return `${datePart}T${timePart}${timezoneOffset}`;
};


const isElementVisible = async (page, selector) => {
  return await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return el ? true : false;
  }, selector);
};
