import openpyxl,json,hashlib,datetime,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='提取 V3.2 工作簿预览参数，不修改源文件')
parser.add_argument('workbook')
args=parser.parse_args()
p=Path(args.workbook)
w=openpyxl.load_workbook(p,read_only=True,data_only=True)
a=list(w['01 基础配置'].values);b=list(w['02 模拟设置'].values)
def cell(rows,r,c):return rows[r-1][c-1]
actions=[]
for r in range(20,42):
 row=a[r+25]
 actions.append(dict(name=cell(a,r,1),minutes=cell(a,r,3),tool=row[1],recovery=list(row[2:6]),cost=list(row[6:10]),materials=list(row[10:16]),output=row[16],quantity=row[17],debit=row[18],category=row[20],skill=row[21],source=f'01 基础配置!A{r}:C{r};A{r+26}:V{r+26}'))
def minute(v):
 if isinstance(v,datetime.datetime):return 1440
 return v.hour*60+v.minute
data=dict(source={'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()},actions=actions,goals=[{'name':cell(a,r,1),'weight':cell(a,r,3)} for r in range(9,14)],hobbyThreshold=cell(a,17,3)/100,schedules=[{'goal':cell(a,r,1),'start':minute(cell(a,r,3)),'end':minute(cell(a,r,4)),'percent':cell(a,r,5)} for r in range(89,95)],initial={'needs':[cell(b,r,4) for r in range(17,21)],'enabled':[cell(b,r,3) for r in range(25,30)],'home':cell(b,32,4),'hobby':cell(b,53,4),'leisure':cell(b,53,7),'tools':{cell(b,r,1):cell(b,r,4) for r in range(68,73)},'materials':[{'name':cell(b,r,1),'carry':cell(b,r,2),'store':cell(b,r,3),'world':cell(b,r,4)} for r in range(84,90)]})
Path('src/preview/balance-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
print('已提取',len(actions),'项行为；来源 SHA256：',data['source']['sha256'])
