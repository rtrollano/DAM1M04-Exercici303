const express = require('express');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const MySQL = require('./utilsMySQL');

const app = express();
const port = 3000;

// Detectar si estem al Proxmox (si és pm2)
const isProxmox = !!process.env.PM2_HOME;

// Iniciar connexió MySQL
const db = new MySQL();
if (!isProxmox) {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'mysqlocal',
    database: 'sakila'
  });
} else {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'abc1exit',
    database: 'sakila'
  });
}

// Static files - ONLY ONCE
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// Disable cache
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Handlebars
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Registrar "Helpers .hbs" aquí
hbs.registerHelper('eq', (a, b) => a == b);
hbs.registerHelper('gt', (a, b) => a > b);

// Partials de Handlebars
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Route
app.get('/', async (req, res) => {
  try {
    // Obtenir les dades de la base de dades

    const moviesRows = await db.query(`select f.title as Titol, f.film_id as Id, f.release_year as Any, group_concat(concat(a.first_name, ' ', a.last_name) separator ', ') as Actors
                                        from film f
                                        join film_actor fa on f.film_id = fa.film_id
                                        join actor a on a.actor_id = fa.actor_id
                                        group by f.film_id, f.title, f.release_year
                                        order by f.title
                                        limit 5`);
    const categoriesRows = await db.query('select category_id as id, name from category limit 5');

    // Transformar les dades a JSON (per les plantilles .hbs)
    // Cal informar de les columnes i els seus tipus
    const moviesJson = db.table_to_json(moviesRows, { id: 'number', titol: 'string', any: 'number' });
    const categoriesJson = db.table_to_json(categoriesRows, { id: 'number', name: 'string' });

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      movies: moviesJson,
      categories: categoriesJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('index', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

app.get('/movies', async (req, res) => {
  try {

    // Obtenir les dades de la base de dades
    const moviesRows = await db.query(`select f.title as Titol, f.film_id as Id, f.release_year as Any, group_concat(concat(a.first_name, ' ', a.last_name) separator ', ') as Actors
                                        from film f
                                        join film_actor fa on f.film_id = fa.film_id
                                        join actor a on a.actor_id = fa.actor_id
                                        group by f.film_id, f.title, f.release_year
                                        order by f.title
                                        limit 15`);

    // Transformar les dades a JSON (per les plantilles .hbs)
    const moviesJson = db.table_to_json(moviesRows, {Titol: 'string',id: 'number',any: 'number', Actors: 'string'});

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      movies: moviesJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('movies', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades per movies');
  }
});

app.get('/customers', async (req, res) => {
  try {

    // Obtenir les dades de la base de dades
    const customersRows = await db.query(`
        select 
            Nom_Client,
            group_concat(Titol separator ' ; ') as Titol,
            group_concat(Data_Lloguer separator ' ; ') as Data_Lloguer
        from (
            select 
                concat(c.first_name, ' ', c.last_name) as Nom_Client,
                f.title as Titol,
                r.rental_date as Data_Lloguer,
                row_number() over (
                    partition by c.customer_id 
                    order by r.rental_date
                ) as rownumber
            from customer c
            join rental r on c.customer_id = r.customer_id
            join inventory i on r.inventory_id = i.inventory_id
            join film f on f.film_id = i.film_id
        ) t
        where rownumber <= 5
        group by Nom_Client
        order by Nom_Client
        limit 25;
      `);

    // Transformar les dades a JSON (per les plantilles .hbs)
    const customersJson = db.table_to_json(customersRows, {
      Nom_client: 'string',
      Titol: 'string',
      Data_Lloguer: 'string'
    });

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      customers: customersJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('customers', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades per Customers');
  }
});
//Hasta aquí es lo mismo que en la práctica anterior, la 302
//A partir de aquí va lo nuevo para la 303

app.get('/moviesAdd', async (req, res) => {
  try {
    
    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    )

    // Construir l'objecte de dades per a la plantilla
    // com que tenim una llista amb un sol element, agafem directament el primer element (cursosJson[0])
    const data = {
      common: commonData
    }

    // Render a new template (recommended)
    res.render('cursAdd', data)
  } catch (err) {
    console.error(err)
    res.status(500).send('Error consultant la base de dades')
  }
})

app.get('/moviesEdit', async (req, res) => {
  try {
    const cursId = parseInt(req.query.id, 10)

    if (!Number.isInteger(cursId) || cursId <= 0) {
      return res.status(400).send('Paràmetre id invàlid')
    }

    const moviesRows = await db.query(`
      select f.title as Titol, 
             f.film_id as Id, f.release_year as Any, 
             group_concat(concat(a.first_name, ' ', a.last_name) separator ', ') as Actors
      from film f
      join film_actor fa on f.film_id = fa.film_id
      join actor a on a.actor_id = fa.actor_id
      WHERE f.id = ${cursId}
      group by f.film_id, f.title, f.release_year
      order by f.title
      limit 1;
    `)

    if (!cursRows || cursRows.length === 0) {
      return res.status(404).send('Pel·lícula no trobada')
    }


    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    )

    res.render('cursEdit', {
      movies: moviesJson,
      common: commonData
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error consultant la base de dades')
  }
})

app.post('/create', async (req, res) => {
  try {

    const table = req.body.table

    if (table == "movies") {

      const titol = req.body.title
      const any = req.body.any

      // Basic validation
      if (!titol || !any) {
        return res.status(400).send('Falten dades')
      }

      await db.query(
        `
        INSERT INTO movies (titol, any)
        VALUES ("${titol}", "${any}")
        `
      )

      // Redirect to list of courses
      res.redirect('/movies')
    }

  } catch (err) {
    console.error(err)
    res.status(500).send('Error afegint el curs')
  }
})

app.post('/delete', async (req, res) => {
  try {

    const table = req.body.table

    if (table == "movies") {

      const id = parseInt(req.body.id, 10)

      // Basic validation
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).send('ID de pel·lícula invàlid')
      }

      await db.query(
        `DELETE FROM movies WHERE id = ${id}`
      )

      res.redirect('/movies')
    }

  } catch (err) {
    console.error(err)
    res.status(500).send('Error esborrant la pel·lícula')
  }
})

app.post('/update', async (req, res) => {
  try {

    const table = req.body.table

    if (table == "cursos") {

      const id = parseInt(req.body.id, 10)
      const titol = req.body.titol
      const any = req.body.any

      // Basic validation
      if (!Number.isInteger(id) || id <= 0) return res.status(400).send('ID invàlid')
      if (!Number.isInteger(mestre_id) || mestre_id <= 0) return res.status(400).send('Mestre invàlid')
      if (!titol || !any) return res.status(400).send('Falten dades')

      // Update curs
      await db.query(`
        UPDATE cursos
        SET titol = "${titol}", any = "${any}"
        WHERE id = ${id};
      `)

      // Keep only 1 mestre per curs (UI)
      await db.query(`DELETE FROM mestre_curs WHERE curs_id = ${id};`)
      await db.query(`INSERT INTO mestre_curs (mestre_id, curs_id) VALUES (${mestre_id}, ${id});`)

      res.redirect(`/curs?id=${id}`)
    }
  } catch (err) {
    console.error(err)
    res.status(500).send('Error editant el curs')
  }
})







// Start server
const httpServer = app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`http://localhost:${port}/movies`);
    console.log(`http://localhost:${port}/customers`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.end();
  httpServer.close();
  process.exit(0);
});