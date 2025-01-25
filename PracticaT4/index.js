const http = require("http");
const fs = require("fs");
const { MongoClient, ObjectId } = require("mongodb");
const url = require("url");
const qs = require("querystring");

const bd = "harry";
const coleccion = "personajes";
const urlConexion = "mongodb://127.0.0.1:27017";
const conexion = new MongoClient(urlConexion);

const server = http.createServer();

server.on("request", async function (peticion, respuesta) {
    try {
        const urlCompleta = url.parse(peticion.url, true);
        const pathname = urlCompleta.pathname;
        const param = urlCompleta.query;

        if (pathname === "/importar" && peticion.method === "GET") {
            await importarDatos();
            const datos = await obtenerDatos();
            const html = await generarHTML(datos);
            respuesta.writeHead(200, { "Content-Type": "text/html" });
            respuesta.end(html);
        } else if ((pathname === "/mostrarTodos" || pathname === "/") && peticion.method === "GET") {
            const datos = await obtenerDatos();
            const html = await generarHTML(datos);
            respuesta.writeHead(200, { "Content-Type": "text/html" });
            respuesta.end(html);
        } else if (pathname.startsWith("/filtro") && peticion.method === "GET") {
            const filtro = obtenerFiltro(pathname);
            const datosFiltrados = await aplicarFiltro(filtro);
            const html = await generarHTML(datosFiltrados);
            respuesta.writeHead(200, { "Content-Type": "text/html" });
            respuesta.end(html);
        } else if (pathname === "/borrar" && peticion.method === "GET") {
            if (param.id != null) {
                await borrar(param.id);
                respuesta.writeHead(302, { "Location": "/mostrarTodos" });
                respuesta.end();
                return;
            }
        } else if (pathname === "/insertar" && peticion.method === "POST") {
            let body = '';
            peticion.on('data', chunk => {
                body += chunk.toString(); // convertir Buffer a string
            });
            peticion.on('end', async () => {
                const datosInsertar = qs.parse(body);
                await insertar(datosInsertar);
                // Redirigir a la página de mostrar todos después de la inserción
                respuesta.writeHead(302, { "Location": "/mostrarTodos" });
                respuesta.end();
            });
        } else {
            respuesta.writeHead(404, { "Content-Type": "text/plain" });
            respuesta.end("Ruta no encontrada");
        }
    } catch (error) {
        console.error(error);
        respuesta.writeHead(500, { "Content-Type": "text/plain" });
        respuesta.end("Error al procesar la solicitud");
    }
});

server.listen(8080, "127.0.0.1", () => {
    console.log("Servidor ejecutándose en http://localhost:8080");
});


async function importarDatos() {
    let client;
    try {
        client = await conexion.connect();
        const dbo = conexion.db(bd);
        const existeColeccion = await dbo.listCollections({ name: coleccion }).hasNext();
        if (existeColeccion) {
            await dbo.collection(coleccion).drop();
        }
        await dbo.createCollection(coleccion);
        const datos = JSON.parse(fs.readFileSync("personajes.json", "utf-8"));
        await dbo.collection(coleccion).insertMany(datos);
    } catch (error) {
        console.error(error);
    } finally {
        if (conexion) {
            // await conexion.close();
        }
    }
}

async function obtenerDatos() {
    await conexion.connect();
    const dbo = conexion.db(bd);
    const datos = await dbo.collection(coleccion).find().toArray();
    // await conexion.close();
    return datos;
}

async function aplicarFiltro(filtro) {
    await conexion.connect();
    const dbo = conexion.db(bd);
    let query;
    switch (filtro) {
        case 1:
            query = { species: "human" };
            break;
        case 2:
            query = { yearOfBirth: { $lt: 1979 } };
            break;
        case 3:
            query = { "wand.wood": "holly" };
            break;
        case 4:
            query = { alive: true, hogwartsStudent: true };
            break;
        default:
            query = {};
    }
    const datosFiltrados = await dbo.collection(coleccion).find(query).toArray();
    // await conexion.close();
    return datosFiltrados;
}

function obtenerFiltro(pathname) {
    const filtro = parseInt(pathname.match(/\d+/)[0], 10);
    return filtro;
}

async function borrar(id) {
    await conexion.connect();
    const dbo = conexion.db(bd);
    const filtro = { '_id': new ObjectId(id) };
    await dbo.collection(coleccion).deleteOne(filtro);
}

async function generarHTML(datos) {
    try {
        let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Personajes de Harry Potter</title>
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        </head>
        <body>
            <div class="container">
                <h1 class="mt-5 mb-4 text-center">Personajes de Harry Potter</h1>
                <div class="mb-3 text-center">
                    <a href="/mostrarTodos" class="btn btn-primary">Mostrar Todos</a>
                    <a href="/filtro1" class="btn btn-secondary">Filtro 1</a>
                    <a href="/filtro2" class="btn btn-secondary">Filtro 2</a>
                    <a href="/filtro3" class="btn btn-secondary">Filtro 3</a>
                    <a href="/filtro4" class="btn btn-secondary">Filtro 4</a>
                </div>
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th scope="col">Imagen</th>
                            <th scope="col">Nombre</th>
                            <th scope="col">Especie</th>
                            <th scope="col">Género</th>
                            <th scope="col">Casa</th>
                            <th scope="col">Año de Nacimiento</th>
                            <th scope="col">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        datos.forEach(personaje => {
            html += `
                <tr>
                    <td><img src="${personaje.image}" alt="${personaje.name}" style="max-width: 100px;"></td>
                    <td>${personaje.name}</td>
                    <td>${personaje.species}</td>
                    <td>${personaje.gender}</td>
                    <td>${personaje.house}</td>
                    <td>${personaje.yearOfBirth}</td>
                    <td><a href="/borrar?id=${personaje._id}" class="btn btn-danger">Borrar</a></td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="container mt-5 mb-4">
                <h2 class="mb-3">Nuevo Personaje</h2>
                <form action="/insertar" method="POST">
                    <div class="form-group">
                        <label for="nombre">Nombre:</label>
                        <input type="text" class="form-control" id="nombre" name="nombre" required>
                    </div>
                    <div class="form-group">
                        <label for="especie">Especie:</label>
                        <input type="text" class="form-control" id="especie" name="especie" required>
                    </div>
                    <div class="form-group">
                        <label for="genero">Género:</label>
                        <input type="text" class="form-control" id="genero" name="genero" required>
                    </div>
                    <div class="form-group">
                        <label for="casa">Casa:</label>
                        <input type="text" class="form-control" id="casa" name="casa" required>
                    </div>
                    <div class="form-group">
                        <label for="anoNacimiento">Año de Nacimiento:</label>
                        <input type="text" class="form-control" id="anoNacimiento" name="anoNacimiento" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>
            </div>
        </body>
        </html>
        `;

        return html;
    } catch (error) {
        console.error("Error al generar HTML:", error);
        throw error;
    }
}

async function insertar(datos) {
    await conexion.connect();
    const dbo = conexion.db(bd);
    await dbo.collection(coleccion).insertOne(datos);
}
