## 1.1.72
* Resolve form type incompatibilities with Symfony 3
* Resolve Request evaluation incompatibilities with Symfony 3
* Improve performance of save / schema switch with many complex schemas (SQL-generated select options etc)
* Fix SHIFT+Tab block unindent in backend form
* Extract Element methods for child class customization:
  * getFeatureTypeService
  * getDataStoreService
  * getFeatureTypeConfig
  * getFeatureTypeConfigForSchema
  * getFeatureTypeForSchema
  * getSchemaConfigs
  * getSchemaConfig
  * getFileUri 
