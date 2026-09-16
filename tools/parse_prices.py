"""Парсер HTML-прайса. Использование: python tools/parse_prices.py input.html output.json"""
import json,re,sys
from html.parser import HTMLParser

class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.buf=[]
    def handle_data(self,data): self.buf.append(data)

if len(sys.argv)!=3: raise SystemExit('Usage: python tools/parse_prices.py input.html output.json')
html=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
p=Parser(); p.feed(html)
text='\n'.join(x.strip().replace('\xa0',' ') for x in p.buf if x.strip())
names=re.findall(r'^(?:Смартфон|Планшет|Часы|Телефон) .+$',text,re.M)
prices=[int(x.replace(' ','')) for x in re.findall(r'^\d[\d ]{2,}$',text,re.M)][::2]
products=[]
for i,(name,price) in enumerate(zip(names,prices),1):
    title=re.sub(r'^(?:Смартфон|Планшет|Часы|Телефон)\s+','',name)
    brand=title.split()[0]
    brand={'Honor':'HONOR','HONOR':'HONOR','Apple':'Apple','Google':'Google','Xiaomi':'Xiaomi','REALME':'realme'}.get(brand,brand)
    m=re.search(r'(\d+)\s*/\s*(\d+)\s*(?:Gb|GB|gb)',title,re.I)
    ram=int(m.group(1)) if m else None; storage=int(m.group(2)) if m else None
    if not storage:
        m=re.search(r'(\d+)\s*(?:Gb|GB|gb)',title,re.I); storage=int(m.group(1)) if m else None
    products.append({'id':i,'name':name,'title':title,'brand':brand,'category':'smartphone' if name.lower().startswith('смартфон') else ('tablet' if name.lower().startswith('планшет') else 'watch'),'ram':ram,'storage':storage,'condition':'used' if re.search(r'б\s*/\s*у|БУ',title,re.I) else 'new','esim':bool(re.search('esim',title,re.I)),'price':price,'currency':'RUB'})
json.dump(products,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print(f'Parsed {len(products)} products')
