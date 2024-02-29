import express from 'express'
import data from './data.js'
import multer from 'multer'

const PORT = 3001
const app = express()
const data1 = data

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './image')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  },
})
const upload = multer({ storage: storage })
//const upload = multer()

//register view engine
app.use(express.json({ extended: false }))
app.use(express.static('./views'))
app.use('/image', express.static('./image'))

//config view
app.set('view engine', 'ejs')
app.set('views', './views')

//routers
app.get('/', (req, res) => {
  //send data1 to view eis
  res.render('index', { data: data1 })
})

// bắt sự kiện thêm
app.post('/save', upload.single('fileimage'), (req, res) => {
  const id = req.body.id
  const name = req.body.name
  const course_type = req.body.course_type
  const semester = req.body.semester
  const department = req.body.department
  const image = req.file

  const params = {
    id: id,
    name: name,
    course_type: course_type,
    semester: semester,
    department: department,
    image: image,
  }

  data1.push(params) // thêm params vào data1
  console.log('Thêm thành công')
  console.log(data1)
  return res.redirect('/') // gọi lại trang index để hiển thị lại data1
})

// bắt sự kiện xóa
app.post('/delete', upload.fields([]), (req, res) => {
  let idcheck = req.body.idcheck
  console.log(idcheck)
  // Kiểm tra xem idcheck có phải là mảng không
  if (!Array.isArray(idcheck)) {
    // Nếu không phải mảng, chuyển nó thành mảng để xử lý tiếp theo
    idcheck = [idcheck]
  }
  console.log(idcheck)
  console.log('Trước khi xoá : ', data1)

  // check idcheck ở trong data1
  idcheck.forEach((id) => {
    // reload lại data1 sau khi thêm ở save
    const index = data1.findIndex((item) => Number(item.id) === Number(id))
    if (index !== -1) {
      data1.splice(index, 1) // xóa 1 phần tử tại vị trí index
      console.log('Xoá thành công')
    } else {
      console.log('Không tìm thấy id')
    }
  })
  console.log('Sau khi xoá : ', data1)
  return res.redirect('/') // gọi lại trang index để hiển thị lại data1
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
