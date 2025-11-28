# PyReport##

Extension converting your normal ipynb file into markdown report. Perfect for students running their calculations in python. Write any python operation, make any markdown cell, all will be included in final raport in neat organized way.

##### Code:

```python
cos35 = math.cos(DegToRad(35))
sin35 = math.sin(DegToRad(35))

alpha = 35
l = 0.5 * 1218 / cos35
ld = 414 / cos35
lg = l - ld
e = 18.57
la = e /10 / cos35
lb = ld/100 - la
q1 = 1.313
q2 = 1.114
Rb = ((q1 - q2) * 0.5 * la**2 + q2* 0.5* (ld/100)**2)/(ld/100)
x = Rb / q2
```

##### Result:

$ cos35 = 0.8192 $ 

$ sin35 = 0.5736 $ 

$ \alpha = 35.0000 $ 

$ l = 0.5*1218/cos35 = 0.5 * 1218 / 0.8192 = 743.4517 $ 

$ ld = 414/cos35 = 414 / 0.8192 = 505.4007 $ 

$ lg = l-ld = 743.4517 - 505.4007 = 238.0510 $ 

$ e = 18.5700 $ 

$ la = e/10/cos35 = 18.5700 /10 / 0.8192 = 2.2670 $ 

$ lb = ld/100-la = 505.4007/100 - 2.2670 = 2.7870 $ 

$ q1 = 1.3130 $ 

$ q2 = 1.1140 $ 

$ Rb = ((q1-q2)*0.5*la**2+q2*0.5*(ld/100)**2)/(ld/100) = ((1.3130 - 1.1140) * 0.5 * 2.2670**2 + 1.1140* 0.5* (505.4007/100)**2)/(505.4007/100) = 2.9163 $ 

$ x = Rb/q2 = 2.9163 / 1.1140 = 2.6178 $ 

## Features:

### Floor Index
By following specific syntax you can automatically create floor syntax in your report:

##### Code:

```python
lol_lol = 1
```

##### Result:

$ lol_{lol} = 1 $

### Markdown in code
Since it is uncomfortable to swtich cells often you can write markdown in python cell

##### Code:

```python
# md: * Some markdown text line 1 *
# md: Some markdown text line 2
lol_lol = 1
```

##### Result:

*Some markdown text line 1* 
Some markdown text line 2

$ lol_{lol} = 1 $

### Commands:

* PyReport:table[\<tableName\>][row names]

##### Code:

```python
# PyReport:table[test][test1, test2, test3]
lol = [1,2,3]
```

##### Result:

*lol* 

| Item | Expression | Replaced | Value |
|---|---|---|---|
| test1 | 1 | 1 | 1 | 
| test2 | 2 | 2 | 2 | 
| test3 | 3 | 3 | 3 | 

### Matrix Support with numpy

##### Code:

```python
import numpy

val1 = 1
val2 = 2
val3 = 3

test = numpy.array([[val1, val1],[val2, val3]])

test2 = test @ test
```

##### Result:

$ val1 = 1.0000 $ 

$ val2 = 2.0000 $ 

$ val3 = 3.0000 $ 


$$ test = \begin{pmatrix} 
 val1 &  val1 \\ 
 val2 &  val3 \\ 
\end{pmatrix} = \begin{pmatrix} 
 1.0000 &  1.0000 \\ 
 2.0000 &  3.0000 \\ 
\end{pmatrix} = \begin{pmatrix} 
 1 &  1 \\ 
 2 &  3 \\ 
\end{pmatrix} $$
$$ test2 = test * test = \begin{pmatrix} 
 1 &  1 \\ 
 2 &  3 \\ 
\end{pmatrix} \cdot \begin{pmatrix} 
 1 &  1 \\ 
 2 &  3 \\ 
\end{pmatrix} = \begin{pmatrix} 
 3 &  4 \\ 
 8 &  11 \\ 
\end{pmatrix} $$