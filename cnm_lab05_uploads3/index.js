import express from 'express'
// import data from './data.js'
import multer from 'multer'
import dotenv from 'dotenv'
dotenv.config()
import path from 'path'
import AWS from 'aws-sdk'

const PORT = 3002
const app = express()

// cấu hinh AWS
process.env.AWS_SDK_JS_SUPPRESS_MAINTENCE_MODE_MESSAGE = '1'

/// cấu hình aws sdk để truy cập vào cloud AWs thông qua tài khoản IAM user
AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
})
const s3 = new AWS.S3() // khai baso service s3
const dynamodb = new AWS.DynamoDB.DocumentClient() // khai báo service dynamodb

const bucketName = process.env.S3_BUCKET_NAME
const tableName = process.env.DYNAMODB_TABLE_NAME
console.log('tableName=', tableName)

// cấu hình multer
const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, '')
  },
})
const upload = multer({
  storage: storage,
  limits: { fileSize: 2000000 }, // giới hạn file 2MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb)
  },
})
// hàm này có chức năng sẽ validate định danh file updalod có phải là ảnh không
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/ // kiểm tra file có phải là ảnh không
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = filetypes.test(file.mimetype)
  if (mimetype && extname) {
    return cb(null, true)
  }
  return cb('Error: Images Only!')
}

//register view engine
app.use(express.json({ extended: false }))
app.use(express.static('./views'))
app.use('/image', express.static('./image'))

//config view
app.set('view engine', 'ejs')
app.set('views', './views')

//routers
app.get('/', async (req, res) => {
  try {
    const params = { TableName: tableName }
    const data = await dynamodb.scan(params).promise() // dùng hàm scan để lấy toàn biij dữ liệu từ bảng
    console.log('data=', data.Items)

    return res.render('index.ejs', { data: data.Items }) // dùng biến reponse để render trang index.ejs và truyền data.Items vào trang index.ejs
    // đồng thời truyền vào data
    // res.render('index.ejs', { data: [] })
  } catch (err) {
    console.log('Error retrieving data from DynamoDB', err)
    return res.status(500).send('Internal Server Error')
  }
})

// bắt sự kiện thêm
app.post('/save', upload.single('fileimage'), (req, res) => {
  try {
    const id = req.body.id
    const name = req.body.name
    const course_type = req.body.course_type
    const semester = req.body.semester
    const department = req.body.department
    const image = req.file?.originalname.split('.')
    const fileType = image[image.length - 1]
    const FilePAth = `${id}_${Date.now().toString()}_${fileType}` // đặt tên cho hình ảnh sẽ lưu trong S3

    const paramsS3 = {
      Bucket: bucketName,
      Key: FilePAth,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }

    s3.upload(paramsS3, async (err, data) => {
      if (err) {
        console.log('Error uploading image to S3', err)
        return res.status(500).send('Internal Server Error')
      } else {
        // khi upload hình ảnh lên S3 thành công
        const imageUrl = data.Location // Gán URL S3 trả về vào field trong table Dy
        const paramsDynamoDB = {
          TableName: tableName,
          Item: {
            id: id,
            name: name,
            course_type: course_type,
            semester: semester,
            department: department,
            image: imageUrl,
          },
        }
        await dynamodb.put(paramsDynamoDB).promise() // lưu dữ liệu vào bảng
        console.log('Data saved to DynamoDB')
        return res.redirect('/') // gọi lại trang index để hiển thị lại data1
      }
    })
  } catch (error) {
    console.log('Error saving data to DynamoDB', error)
  }
})

// bắt sự kiện xóa
app.post('/delete', upload.fields([]), (req, res) => {
  const listCheckboxSelected = Object.keys(req.body) // Lấy ra tất cả checkboxes
  // req.body trả về 1 object chứa các cặp key & value định dạng:
  // '123456': 'on',
  // '123458': 'on',
  //listCheckboxSelected trả về 1 array: [ '123456', '123458', '96707133' ]
  if (!listCheckboxSelected || listCheckboxSelected.length <= 0) {
    return res.redirect('/')
  }
  try {
    function onDeleteItem(length) {
      // Định nghĩa hàm đệ quy xóa
      const params = {
        TableName: tableName,
        Key: {
          id: listCheckboxSelected[length],
        },
      }
      dynamodb.delete(params, (err, data) => {
        if (err) {
          console.error('error=', err)
          return res.send('Interal Server Error!')
        } else if (length > 0) onDeleteItem(length - 1)
        else return res.redirect('/')
      })
    }
    onDeleteItem(listCheckboxSelected.length - 1) // Gọi hàm đệ quy xóa
  } catch (error) {
    console.error('Error deleting data from DynamoDB:', error)
    return res.status(500).send('Internal Server Error')
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
